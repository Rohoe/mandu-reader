/**
 * Multi-turn chat API — extends callLLM pattern for conversation history.
 * Supports Anthropic, OpenAI, OpenAI-compatible, and Gemini providers.
 */

import { createTimeoutController, fetchWithRetry, classifyApiError, buildAnthropicHeaders, parseSSEStream } from './apiUtils';

// ── Sliding window ──────────────────────────────────────────

const MAX_MESSAGES = 20;

function trimMessages(messages) {
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(-MAX_MESSAGES);
}

// ── Provider message formatting ─────────────────────────────

function buildAnthropicChat(apiKey, model, systemPrompt, messages, maxTokens, signal) {
  // Use cache_control on system prompt so it's cached across turns
  const system = systemPrompt
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : undefined;
  return {
    url: 'https://api.anthropic.com/v1/messages',
    options: {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: trimMessages(messages).map(m => ({ role: m.role, content: m.content })),
      }),
      signal,
    },
    label: 'Anthropic',
    extract: data => data.content[0].text,
  };
}

function buildOpenAIChat(apiKey, model, systemPrompt, messages, maxTokens, signal, baseUrl) {
  const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  msgs.push(...trimMessages(messages).map(m => ({ role: m.role, content: m.content })));
  return {
    url,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: msgs }),
      signal,
    },
    label: baseUrl ? 'OpenAI-Compatible' : 'OpenAI',
    extract: data => data.choices[0].message.content,
  };
}

function buildGeminiChat(apiKey, model, systemPrompt, messages, maxTokens, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = trimMessages(messages).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] };
  }
  return {
    url,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    label: 'Gemini',
    extract: data => data.candidates[0].content.parts[0].text,
  };
}

function buildChatRequest(llmConfig, systemPrompt, messages, maxTokens, signal) {
  const { provider, apiKey, model, baseUrl } = llmConfig;
  switch (provider) {
    case 'anthropic':
      return buildAnthropicChat(apiKey, model, systemPrompt, messages, maxTokens, signal);
    case 'gemini':
      return buildGeminiChat(apiKey, model, systemPrompt, messages, maxTokens, signal);
    case 'openai':
    case 'openai_compatible':
    default:
      return buildOpenAIChat(apiKey, model, systemPrompt, messages, maxTokens, signal, baseUrl);
  }
}

// ── Public: non-streaming chat ──────────────────────────────

/**
 * Send a multi-turn chat request to any configured LLM provider.
 * @param {object} llmConfig - { provider, apiKey, model, baseUrl }
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} maxTokens
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<string>} Assistant response text
 */
export async function callLLMChat(llmConfig, systemPrompt, messages, maxTokens = 2048, { signal: externalSignal } = {}) {
  const { apiKey, model } = llmConfig;
  if (!apiKey) throw new Error('No API key provided. Please add your API key in Settings.');

  const { signal, cleanup } = createTimeoutController(externalSignal);

  try {
    const { url, options, label, extract } = buildChatRequest(llmConfig, systemPrompt, messages, maxTokens, signal);
    return await fetchWithRetry(url, options, extract, label);
  } catch (err) {
    throw new Error(classifyApiError(err, model));
  } finally {
    cleanup();
  }
}

// ── Public: streaming chat (Anthropic only) ─────────────────

/**
 * Async generator that streams chat responses from Anthropic.
 * Falls back to non-streaming for other providers.
 */
export async function* callLLMChatStream(llmConfig, systemPrompt, messages, maxTokens = 2048, { signal: externalSignal } = {}) {
  const { provider, apiKey, model } = llmConfig;
  if (!apiKey) throw new Error('No API key provided. Please add your API key in Settings.');

  if (provider !== 'anthropic') {
    // Non-streaming fallback
    const text = await callLLMChat(llmConfig, systemPrompt, messages, maxTokens, { signal: externalSignal });
    yield text;
    return;
  }

  const { signal, cleanup } = createTimeoutController(externalSignal);

  try {
    const system = systemPrompt
      ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
      : undefined;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        ...(system ? { system } : {}),
        messages: trimMessages(messages).map(m => ({ role: m.role, content: m.content })),
      }),
      signal,
    });

    if (!response.ok) {
      let msg = `[Anthropic] API error ${response.status}`;
      try {
        const errBody = await response.json();
        msg = errBody.error?.message || errBody.message || msg;
      } catch { /* ignore */ }
      const rawErr = new Error(msg);
      rawErr.status = response.status;
      throw new Error(classifyApiError(rawErr, model));
    }

    yield* parseSSEStream(response);
  } finally {
    cleanup();
  }
}

// ── External tutor prompt builder ───────────────────────────

/**
 * Builds a self-contained prompt for pasting into Claude or ChatGPT.
 * Includes all lesson context so the external LLM can act as a tutor.
 */
export function buildExternalTutorPrompt(reader, lessonMeta, langConfig, nativeLangName) {
  const level = reader?.level ?? lessonMeta?.level ?? 3;
  const profName = langConfig.proficiency.name;
  const targetLang = langConfig.prompts.targetLanguage;

  let prompt = `You are a patient, encouraging language tutor for ${targetLang} at ${profName} level ${level}.\n\n`;
  prompt += `The student's native language is ${nativeLangName}. Use ${nativeLangName} for explanations and definitions. Default to ${targetLang} for practice and conversation.\n\n`;

  if (reader?.story) {
    const storyExcerpt = reader.story.length > 2000
      ? reader.story.slice(0, 1000) + '\n\n[...]\n\n' + reader.story.slice(-800)
      : reader.story;
    prompt += `## Story\n${storyExcerpt}\n\n`;
  }

  if (reader?.vocabulary?.length > 0) {
    prompt += `## Vocabulary\n`;
    for (const v of reader.vocabulary.slice(0, 20)) {
      const word = v.target || v.chinese || v.korean || v.word || '';
      const def = v.translation || v.english || v.definition || '';
      const rom = (v.romanization || v.pinyin || v.jyutping) ? ` (${v.romanization || v.pinyin || v.jyutping})` : '';
      prompt += `- **${word}**${rom} — ${def}\n`;
    }
    prompt += '\n';
  }

  if (reader?.grammarNotes?.length > 0) {
    prompt += `## Grammar Notes\n`;
    for (const g of reader.grammarNotes) {
      prompt += `- **${g.pattern}** (${g.label}) — ${g.explanation}\n`;
    }
    prompt += '\n';
  }

  if (reader?.quizResults) {
    prompt += `## Quiz Results\nScore: ${reader.quizResults.score ?? 'N/A'}\n`;
    if (reader.quizResults.results) {
      for (const r of reader.quizResults.results) {
        prompt += `- Q: ${r.question} → ${r.correct ? 'Correct' : 'Incorrect'}${r.feedback ? ` (${r.feedback})` : ''}\n`;
      }
    }
    prompt += '\n';
  }

  prompt += `## Instructions\nHelp the student review this lesson. You can:\n- Quiz them on vocabulary\n- Explain grammar patterns\n- Discuss the story in ${targetLang}\n- Correct their writing\n- Suggest areas for improvement\n\nStart by greeting the student and asking what they'd like to work on.`;

  return prompt;
}
