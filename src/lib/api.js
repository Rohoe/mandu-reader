/**
 * LLM API integration — supports Anthropic, OpenAI, Google Gemini,
 * and OpenAI-compatible providers (DeepSeek, Groq, etc.).
 *
 * All public functions accept an `llmConfig` object as the first parameter:
 *   { provider, apiKey, model, baseUrl }
 */

import { getLang, DEFAULT_LANG_ID } from './languages';
import { getNativeLang } from './nativeLanguages';
import { buildSyllabusPrompt } from '../prompts/syllabusPrompt';
import { buildReaderSystem } from '../prompts/readerSystemPrompt';
import { buildGradingSystem } from '../prompts/gradingPrompt';
import { buildExtendSyllabusPrompt } from '../prompts/extendSyllabusPrompt';
import { createTimeoutController, parseJSONWithFallback } from './apiUtils';

// ── Error classification ──────────────────────────────────────

/**
 * Rewrites raw API errors into actionable user-facing messages.
 * Returns the original message if no classification matches.
 */
export function classifyApiError(err, model) {
  const status = err.status;
  const msg = (err.message || '').toLowerCase();

  if (status === 404 && (msg.includes('model') || msg.includes('not_found') || msg.includes('not found'))) {
    return `Model "${model}" is not available. Check the model in Settings or switch to a different one.`;
  }
  if (status === 401 || status === 403) {
    return 'Invalid API key. Check your key in Settings.';
  }
  return err.message;
}

// ── Shared retry logic ─────────────────────────────────────────

const MAX_RETRIES   = 2;
const BASE_DELAY_MS = 1000;

export function isRetryable(status) {
  return status >= 500 || status === 429;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry: shared across all providers.
 * @param {string} url
 * @param {object} options - fetch options (may include signal)
 * @param {function} extractText - (responseData) => string
 * @param {string} providerLabel - for error messages
 */
async function fetchWithRetry(url, options, extractText, providerLabel) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        let msg = `[${providerLabel}] API error ${response.status}`;
        try {
          const err = await response.json();
          msg = err.error?.message || err.message || msg;
        } catch { /* ignore */ }
        const error = new Error(msg);
        error.status = response.status;

        if (!isRetryable(response.status) || attempt === MAX_RETRIES) throw error;
        lastError = error;
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[${providerLabel}] ${response.status} on attempt ${attempt + 1}, retrying in ${backoff}ms…`);
        await delay(backoff);
        continue;
      }

      const data = await response.json();
      return extractText(data);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out. Try again or switch to a faster provider.');
      if (err.status !== undefined) throw err;
      if (attempt === MAX_RETRIES) throw err;
      lastError = err;
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[${providerLabel}] Network error on attempt ${attempt + 1}, retrying in ${backoff}ms…`, err.message);
      await delay(backoff);
    }
  }

  throw lastError;
}

// ── Provider config registry ─────────────────────────────────

const ANTHROPIC_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': null,          // placeholder, set per-request
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
};

function buildAnthropicHeaders(apiKey) {
  return { ...ANTHROPIC_HEADERS, 'x-api-key': apiKey };
}

/**
 * Provider registry: maps provider ID → { buildRequest, extractText, buildStructuredRequest, extractStructuredText }
 *
 * buildRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl)
 *   → { url, options, label }
 *
 * buildStructuredRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl)
 *   → { url, options, label }
 */
const PROVIDERS = {
  anthropic: {
    buildRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal) {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        options: {
          method: 'POST',
          headers: buildAnthropicHeaders(apiKey),
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: [{ role: 'user', content: userMessage }],
          }),
          signal,
        },
        label: 'Anthropic',
      };
    },
    extractText: data => data.content[0].text,

    buildStructuredRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal) {
      const tool = {
        name: 'create_reader',
        description: 'Create a structured graded reader response',
        input_schema: READER_JSON_SCHEMA,
      };
      return {
        url: 'https://api.anthropic.com/v1/messages',
        options: {
          method: 'POST',
          headers: buildAnthropicHeaders(apiKey),
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: [{ role: 'user', content: userMessage }],
            tools: [tool],
            tool_choice: { type: 'tool', name: 'create_reader' },
          }),
          signal,
        },
        label: 'Anthropic',
      };
    },
    extractStructuredText: data => {
      const toolBlock = data.content.find(b => b.type === 'tool_use');
      if (!toolBlock) throw new Error('Anthropic did not return structured output');
      return JSON.stringify(toolBlock.input);
    },
  },

  openai: {
    buildRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl) {
      const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userMessage });
      return {
        url,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
          signal,
        },
        label: baseUrl ? 'OpenAI-Compatible' : 'OpenAI',
      };
    },
    extractText: data => data.choices[0].message.content,

    buildStructuredRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl) {
      const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userMessage });
      return {
        url,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages,
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'graded_reader',
                strict: true,
                schema: READER_JSON_SCHEMA,
              },
            },
          }),
          signal,
        },
        label: baseUrl ? 'OpenAI-Compatible' : 'OpenAI',
      };
    },
    extractStructuredText: data => data.choices[0].message.content,
  },

  gemini: {
    buildRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
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
      };
    },
    extractText: data => data.candidates[0].content.parts[0].text,

    buildStructuredRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          responseSchema: READER_JSON_SCHEMA,
        },
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
      };
    },
    extractStructuredText: data => data.candidates[0].content.parts[0].text,
  },
};

// openai_compatible reuses openai's config
PROVIDERS.openai_compatible = PROVIDERS.openai;

function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.anthropic;
}

// ── Unified dispatcher ──────────────────────────────────────────

/**
 * Call an LLM provider. Supports both plain text and structured output modes.
 *
 * @param {object} llmConfig - { provider, apiKey, model, baseUrl }
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {number} maxTokens
 * @param {{ signal?: AbortSignal, structured?: boolean }} options
 */
async function callLLM(llmConfig, systemPrompt, userMessage, maxTokens = 4096, { signal: externalSignal, structured = false } = {}) {
  const { provider, apiKey, model, baseUrl } = llmConfig;
  if (!apiKey) throw new Error('No API key provided. Please add your API key in Settings.');

  const { signal, cleanup } = createTimeoutController(externalSignal);
  const providerConfig = getProvider(provider);

  try {
    const { url, options, label } = structured
      ? providerConfig.buildStructuredRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl)
      : providerConfig.buildRequest(apiKey, model, systemPrompt, userMessage, maxTokens, signal, baseUrl);
    const extractor = structured ? providerConfig.extractStructuredText : providerConfig.extractText;
    return await fetchWithRetry(url, options, extractor, label);
  } catch (err) {
    throw new Error(classifyApiError(err, model));
  } finally {
    cleanup();
  }
}

// ── Anthropic streaming ──────────────────────────────────────

/**
 * Async generator that streams text deltas from Anthropic's messages API.
 * Yields string chunks as they arrive.
 */
async function* callAnthropicStream(apiKey, model, systemPrompt, userMessage, maxTokens, signal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: buildAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userMessage }],
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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield event.delta.text;
          }
        } catch { /* skip non-JSON lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Shared reader message builder ─────────────────────────────

const MAX_VOCAB_LIST = 200;

/**
 * Builds the user message for reader generation, including learned vocabulary,
 * optional continuation context, syllabus context, vocabulary focus, and
 * grammar tracking.
 */
function buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar } = {}) {
  const learnedList = Object.keys(learnedWords)
    .filter(w => !learnedWords[w].langId || learnedWords[w].langId === langId)
    .sort((a, b) => (learnedWords[b].dateAdded || 0) - (learnedWords[a].dateAdded || 0))
    .slice(0, MAX_VOCAB_LIST);
  const learnedSection = learnedList.length > 0
    ? `\n\nPreviously learned vocabulary (do NOT list as new vocabulary, but naturally incorporate 3-5 of these words into the story for reinforcement):\n${learnedList.join(', ')}`
    : '';

  // Vocabulary focus from syllabus lesson metadata
  const vocabFocusSection = vocabFocus?.length > 0
    ? `\n\nVocabulary focus for this lesson: ${vocabFocus.join(', ')}. Prioritize selecting new vocabulary related to these themes.`
    : '';

  // Cumulative lesson context from syllabus
  const syllabusSection = syllabusContext
    ? `\n\n${syllabusContext}`
    : '';

  // Grammar patterns already taught in prior lessons
  const grammarSection = taughtGrammar?.length > 0
    ? `\n\nGrammar patterns already taught (do not repeat as grammar notes; you may use them in the story):\n${taughtGrammar.join(', ')}`
    : '';

  // Smart story truncation preserving beginning and end
  let storyExcerpt;
  if (previousStory) {
    if (previousStory.length <= 1000) {
      storyExcerpt = previousStory;
    } else if (previousStory.length <= 2000) {
      storyExcerpt = previousStory.slice(0, 300) + '\n\n[...]\n\n' + previousStory.slice(-600);
    } else {
      storyExcerpt = previousStory.slice(0, 300) + '\n\n[...middle omitted...]\n\n' + previousStory.slice(-600);
    }
  }
  const continuationSection = storyExcerpt
    ? `\n\nThis is a continuation. Previous episode for narrative context:\n---\n${storyExcerpt}\n---\nContinue the story with new events, maintaining the same characters and setting.`
    : '';

  return `Generate a graded reader for the topic: ${topic}${syllabusSection}${vocabFocusSection}${learnedSection}${grammarSection}${continuationSection}`;
}

/**
 * Streaming variant of generateReader. Returns an async generator of text chunks.
 * Only supports Anthropic provider.
 */
export async function* generateReaderStream(llmConfig, topic, level, learnedWords = {}, targetChars = 1200, maxTokens = 8192, previousStory = null, langId = DEFAULT_LANG_ID, { signal: externalSignal, nativeLang = 'en', vocabFocus, syllabusContext, taughtGrammar, difficultyHint } = {}) {
  const { apiKey, model } = llmConfig;
  if (!apiKey) throw new Error('No API key provided. Please add your API key in Settings.');

  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const rangePadding = targetChars <= 300 ? 50 : 100;
  const charRange = `${targetChars - rangePadding}-${targetChars + rangePadding}`;
  const system = buildReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint });
  const userMessage = buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar });

  const { signal, cleanup } = createTimeoutController(externalSignal);

  try {
    yield* callAnthropicStream(apiKey, model, system, userMessage, maxTokens, signal);
  } finally {
    cleanup();
  }
}

// ── Syllabus generation ───────────────────────────────────────

export async function generateSyllabus(llmConfig, topic, level, lessonCount = 6, langId = DEFAULT_LANG_ID, nativeLang = 'en') {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const prompt = buildSyllabusPrompt(langConfig, topic, level, lessonCount, nativeLangName);

  const raw = await callLLM(llmConfig, '', prompt, 2048);
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid syllabus format. Please try again.');

  // Normalise: handle both new { summary, lessons } and old plain-array formats
  if (Array.isArray(result)) {
    return { summary: '', lessons: result };
  }
  return { summary: result.summary || '', lessons: result.lessons || [] };
}

// ── Answer grading ────────────────────────────────────────────

// Escape literal control characters inside JSON string values so JSON.parse
// doesn't choke on responses like: "feedback": "Good.\nAlso try harder."
// Handles all ASCII control chars (< 0x20) and also strips markdown fences.
function repairJSON(str) {
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const fenceMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) str = fenceMatch[1].trim();

  let result = '';
  let inString = false;
  let escaped = false;
  for (const char of str) {
    const code = char.codePointAt(0);
    if (escaped) {
      result += char;
      escaped = false;
    } else if (char === '\\' && inString) {
      result += char;
      escaped = true;
    } else if (char === '"') {
      result += char;
      inString = !inString;
    } else if (inString && code < 0x20) {
      // Escape any bare control character inside a string
      if (char === '\n') result += '\\n';
      else if (char === '\r') result += '\\r';
      else if (char === '\t') result += '\\t';
      else if (char === '\b') result += '\\b';
      else if (char === '\f') result += '\\f';
      else result += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      result += char;
    }
  }
  return result;
}

export async function gradeAnswers(llmConfig, questions, userAnswers, story, level, maxTokens = 2048, langId = DEFAULT_LANG_ID, nativeLang = 'en') {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const system = buildGradingSystem(langConfig, level, nativeLangName);
  const answersBlock = questions
    .map((q, i) => `Q${i + 1}: ${typeof q === 'string' ? q : q.text}\nA${i + 1}: ${userAnswers[i] || '(no answer provided)'}`)
    .join('\n\n');
  const userMessage = `Story (for reference):\n${story}\n\n---\n\nQuestions and Student Answers:\n${answersBlock}`;
  const raw = await callLLM(llmConfig, system, userMessage, maxTokens);
  const cleaned = repairJSON(raw.trim());
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
    throw new Error('Grading response could not be parsed. Please try again.');
  }
}

// ── Structured output schema ──────────────────────────────────

export const READER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title_target:  { type: 'string', description: 'Title in the target language' },
    title_en:      { type: 'string', description: 'English subtitle' },
    story:         { type: 'string', description: 'The story text with **bolded** vocabulary and *italicized* proper nouns' },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target:       { type: 'string', description: 'Word in target language' },
          romanization: { type: 'string', description: 'Pinyin, jyutping, or romanization' },
          english:      { type: 'string', description: 'English definition' },
          example_story:             { type: 'string', description: 'Example sentence from the story' },
          usage_note_story:          { type: 'string', description: 'Grammar/usage note for story example' },
          example_extra:             { type: 'string', description: 'Additional example sentence' },
          usage_note_extra:          { type: 'string', description: 'Grammar/usage note for extra example' },
        },
        required: ['target', 'romanization', 'english', 'example_story'],
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text:        { type: 'string', description: 'Question in target language' },
        },
        required: ['text'],
      },
    },
    grammar_notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern:     { type: 'string', description: 'Grammar pattern in target language' },
          label:       { type: 'string', description: 'English name of the pattern' },
          explanation: { type: 'string', description: 'One-sentence explanation' },
          example:     { type: 'string', description: 'Example from the story' },
        },
        required: ['pattern', 'label', 'explanation', 'example'],
      },
    },
  },
  required: ['title_target', 'title_en', 'story', 'vocabulary', 'questions', 'grammar_notes'],
};

// ── Reader generation ─────────────────────────────────────────

export async function generateReader(llmConfig, topic, level, learnedWords = {}, targetChars = 1200, maxTokens = 8192, previousStory = null, langId = DEFAULT_LANG_ID, { signal, structured = false, nativeLang = 'en', vocabFocus, syllabusContext, taughtGrammar, difficultyHint } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const rangePadding = targetChars <= 300 ? 50 : 100;
  const charRange = `${targetChars - rangePadding}-${targetChars + rangePadding}`;
  const system = buildReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint });
  const userMessage = buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar });

  return await callLLM(llmConfig, system, userMessage, maxTokens, { signal, structured });
}

// ── Syllabus extension ────────────────────────────────────────

export async function extendSyllabus(llmConfig, topic, level, existingLessons, additionalCount = 3, langId = DEFAULT_LANG_ID, nativeLang = 'en') {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const prompt = buildExtendSyllabusPrompt(langConfig, topic, level, existingLessons, additionalCount, nativeLangName);

  const raw = await callLLM(llmConfig, '', prompt, 2048);
  const lessons = parseJSONWithFallback(raw, 'LLM returned an invalid lesson format. Please try again.');

  if (!Array.isArray(lessons)) throw new Error('Expected an array of lessons. Please try again.');
  return { lessons };
}
