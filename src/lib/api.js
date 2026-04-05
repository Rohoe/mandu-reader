/**
 * LLM API integration — supports Anthropic, OpenAI, Google Gemini,
 * and OpenAI-compatible providers (DeepSeek, Groq, etc.).
 *
 * All public functions accept an `llmConfig` object as the first parameter:
 *   { provider, apiKey, model, baseUrl }
 */

import { getLang, DEFAULT_LANG_ID, isAdvancedLevel } from './languages';
import { getNativeLang } from './nativeLanguages';
import { buildSyllabusPrompt } from '../prompts/syllabusPrompt';
import { buildReaderSystem } from '../prompts/readerSystemPrompt';
import { buildGradingSystem } from '../prompts/gradingPrompt';
import { buildExtendSyllabusPrompt } from '../prompts/extendSyllabusPrompt';
import { buildNarrativeSyllabusPrompt } from '../prompts/narrativeSyllabusPrompt';
import { buildExtendNarrativeSyllabusPrompt } from '../prompts/extendNarrativeSyllabusPrompt';
import { buildNarrativeReaderSystem } from '../prompts/narrativeReaderPrompt';
import { buildLearningPathPrompt, buildExtendPathPrompt } from '../prompts/learningPathPrompt';
import { buildPathUnitSyllabusPrompt } from '../prompts/pathUnitSyllabusPrompt';
import { createTimeoutController, parseJSONWithFallback, fetchWithRetry, isRetryable, classifyApiError, buildAnthropicHeaders, parseSSEStream } from './apiUtils';

export { isRetryable, classifyApiError };

// ── Provider config registry ─────────────────────────────────

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
export async function callLLM(llmConfig, systemPrompt, userMessage, maxTokens = 4096, { signal: externalSignal, structured = false } = {}) {
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

  yield* parseSSEStream(response);
}

// ── Shared reader message builder ─────────────────────────────

/**
 * Builds the user message for reader generation, including
 * optional continuation context, syllabus context, vocabulary focus, and
 * grammar tracking. Learner vocabulary state is handled by the Learner
 * Adaptation Context section (from buildLearnerContext) rather than raw
 * word lists — the LLM uses the compact summary more effectively.
 */
function buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar, learnerContext, narrativeContext } = {}) {
  // Vocabulary focus from syllabus lesson metadata
  const vocabFocusSection = vocabFocus?.length > 0
    ? `\n\nVocabulary focus for this lesson: ${vocabFocus.join(', ')}. Prioritize selecting new vocabulary related to these themes.`
    : '';

  // Cumulative lesson context from syllabus (narrative context takes precedence)
  const syllabusSection = narrativeContext
    ? `\n\n${narrativeContext}`
    : syllabusContext
      ? `\n\n${syllabusContext}`
      : '';

  // Grammar patterns already taught in prior lessons
  const grammarSection = taughtGrammar?.length > 0
    ? `\n\nGrammar patterns already taught (do not repeat as grammar notes; you may use them in the story):\n${taughtGrammar.join(', ')}`
    : '';

  // Learner adaptation context from SRS/quiz history
  const learnerSection = learnerContext
    ? `\n\n## Learner Adaptation Context\n${learnerContext}`
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

  return `Generate a graded reader for the topic: ${topic}${syllabusSection}${vocabFocusSection}${grammarSection}${learnerSection}${continuationSection}`;
}

/**
 * Streaming variant of generateReader. Returns an async generator of text chunks.
 * Only supports Anthropic provider.
 */
export async function* generateReaderStream(llmConfig, topic, level, learnedWords = {}, targetChars = 1200, maxTokens = 8192, previousStory = null, langId = DEFAULT_LANG_ID, { signal: externalSignal, nativeLang = 'en', vocabFocus, syllabusContext, taughtGrammar, difficultyHint, learnerContext, narrativeContext, narrativeType } = {}) {
  const { apiKey, model } = llmConfig;
  if (!apiKey) throw new Error('No API key provided. Please add your API key in Settings.');

  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const rangePadding = targetChars <= 300 ? 50 : 100;
  const charRange = `${targetChars - rangePadding}-${targetChars + rangePadding}`;
  const system = narrativeType
    ? buildNarrativeReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint, narrativeType, useTargetLang })
    : buildReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint, useTargetLang });
  const userMessage = buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar, learnerContext, narrativeContext });

  const { signal, cleanup } = createTimeoutController(externalSignal);

  try {
    yield* callAnthropicStream(apiKey, model, system, userMessage, maxTokens, signal);
  } finally {
    cleanup();
  }
}

// ── Syllabus generation ───────────────────────────────────────

export async function generateSyllabus(llmConfig, topic, level, lessonCount = 6, langId = DEFAULT_LANG_ID, nativeLang = 'en', { learnerProfile, recentTopics } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const prompt = buildSyllabusPrompt(langConfig, topic, level, lessonCount, nativeLangName, { learnerProfile, recentTopics, useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 2048);
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid syllabus format. Please try again.');

  // Normalise: handle both new { summary, lessons } and old plain-array formats
  if (Array.isArray(result)) {
    return { summary: '', lessons: result, suggestedTopics: [] };
  }
  return { summary: result.summary || '', lessons: result.lessons || [], suggestedTopics: result.suggested_topics || result.suggestedTopics || [] };
}

// ── Narrative syllabus generation ─────────────────────────

export async function generateNarrativeSyllabus(llmConfig, sourceMaterial, narrativeType, level, lessonCount = 20, langId = DEFAULT_LANG_ID, nativeLang = 'en', { learnerProfile } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const prompt = buildNarrativeSyllabusPrompt(langConfig, sourceMaterial, narrativeType, level, lessonCount, nativeLangName, { learnerProfile, useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 8192);
  if (typeof raw === 'string' && raw.length > 0) {
    const trimmed = raw.trim();
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar !== '}' && lastChar !== ']') {
      console.error('[narrativeSyllabus] Response appears truncated. Last 200 chars:', trimmed.slice(-200));
      throw new Error('Narrative syllabus response was truncated — try reducing the lesson count.');
    }
  }
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid narrative syllabus format. Please try again.');

  return {
    narrativeArc: result.narrative_arc || {},
    lessons: result.lessons || [],
    futureArc: result.future_arc || null,
    suggestedTopics: result.suggested_topics || result.suggestedTopics || [],
  };
}

// ── Learning Path blueprint generation ────────────────────────

export async function generateLearningPath(llmConfig, profile, langId = DEFAULT_LANG_ID, nativeLang = 'en') {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, profile.level);
  const prompt = buildLearningPathPrompt(langConfig, profile, nativeLangName, { useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 8192);
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid learning path format. Please try again.');

  return {
    title: result.title || '',
    description: result.description || '',
    units: (result.units || []).map((u, i) => ({
      unitIndex: i,
      title: u.title,
      description: u.description,
      estimatedLessons: u.estimated_lessons || u.estimatedLessons || 8,
      style: u.style || 'thematic',
      vocabThemes: u.vocab_themes || u.vocabThemes || [],
      sourceMaterial: u.source_material || u.sourceMaterial || null,
      syllabusId: null,
      status: 'pending',
    })),
    continuationContext: result.continuation_context || result.continuationContext || null,
  };
}

export async function extendLearningPathAPI(llmConfig, path, additionalCount = 5, nativeLang = 'en') {
  const langConfig = getLang(path.langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(path.langId, path.level);
  const prompt = buildExtendPathPrompt(langConfig, path, additionalCount, nativeLangName, { useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 8192);
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid extension format. Please try again.');

  return {
    units: (result.units || []).map(u => ({
      title: u.title,
      description: u.description,
      estimatedLessons: u.estimated_lessons || u.estimatedLessons || 8,
      style: u.style || 'thematic',
      vocabThemes: u.vocab_themes || u.vocabThemes || [],
      sourceMaterial: u.source_material || u.sourceMaterial || null,
    })),
    continuationContext: result.continuation_context || result.continuationContext || null,
  };
}

export async function generatePathUnitSyllabus(llmConfig, unit, pathContext, level, lessonCount = 8, langId = DEFAULT_LANG_ID, nativeLang = 'en', { learnerProfile } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const prompt = buildPathUnitSyllabusPrompt(langConfig, unit, pathContext, level, lessonCount, nativeLangName, { learnerProfile, useTargetLang });

  const maxTokens = unit.style === 'narrative' ? 8192 : 2048;
  const raw = await callLLM(llmConfig, '', prompt, maxTokens);
  const result = parseJSONWithFallback(raw, 'LLM returned an invalid syllabus format. Please try again.');

  // Narrative units return narrative_arc structure
  if (unit.style === 'narrative' && result.narrative_arc) {
    return {
      type: 'narrative',
      narrativeArc: result.narrative_arc,
      lessons: result.lessons || [],
      futureArc: result.future_arc || null,
      suggestedTopics: result.suggested_topics || [],
    };
  }

  // Standard/exploratory units
  if (Array.isArray(result)) {
    return { summary: '', lessons: result, suggestedTopics: [] };
  }
  return {
    summary: result.summary || '',
    lessons: result.lessons || [],
    suggestedTopics: result.suggested_topics || result.suggestedTopics || [],
  };
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

/**
 * Client-side grading for multiple-choice questions.
 * Returns { feedback: [...], totalScore, mcCount }
 * feedback[i] = null for FR questions, { score, feedback, suggestedAnswer } for MC.
 */
export function gradeMultipleChoice(questions, userAnswers) {
  let totalScore = 0;
  let mcCount = 0;
  const feedback = questions.map((q, i) => {
    if (q.type === 'mc') {
      mcCount++;
      const userChoice = (userAnswers[i] || '').toUpperCase();
      const correct = (q.correctAnswer || '').toUpperCase();
      const isCorrect = userChoice === correct;
      const score = isCorrect ? 5 : 1;
      totalScore += score;
      const correctOption = (q.options || []).find(o => o.startsWith(correct + '.')) || correct;
      return {
        score: `${score}/5`,
        feedback: isCorrect ? '' : '',
        suggestedAnswer: isCorrect ? null : correctOption,
      };
    }
    if (q.type === 'tf') {
      mcCount++;
      const userChoice = (userAnswers[i] || '').toUpperCase();
      const correct = (q.correctAnswer || '').toUpperCase();
      const isCorrect = userChoice === correct;
      const score = isCorrect ? 5 : 1;
      totalScore += score;
      return {
        score: `${score}/5`,
        feedback: '',
        suggestedAnswer: isCorrect ? null : correct,
      };
    }
    if (q.type === 'fb') {
      mcCount++;
      const userChoice = (userAnswers[i] || '').trim();
      const correct = (q.correctAnswer || '').trim();
      const isCorrect = userChoice === correct;
      const score = isCorrect ? 5 : 1;
      totalScore += score;
      return {
        score: `${score}/5`,
        feedback: '',
        suggestedAnswer: isCorrect ? null : correct,
      };
    }
    if (q.type === 'vm') {
      mcCount++;
      const userPairs = userAnswers[i]; // expected: { word: definition } map
      const correctPairs = q.pairs || [];
      if (!userPairs || typeof userPairs !== 'object') {
        totalScore += 1;
        return { score: '1/5', feedback: '', suggestedAnswer: null };
      }
      let correctCount = 0;
      correctPairs.forEach(p => {
        if (userPairs[p.word] === p.definition) correctCount++;
      });
      const total = correctPairs.length;
      const score = total > 0 ? Math.max(1, Math.round((correctCount / total) * 5)) : 1;
      totalScore += score;
      return {
        score: `${score}/5`,
        feedback: '',
        suggestedAnswer: correctCount < total ? correctPairs.map(p => `${p.word} = ${p.definition}`).join(', ') : null,
      };
    }
    return null; // FR or unknown → null (backward compat)
  });
  return { feedback, totalScore, mcCount };
}

export async function gradeAnswers(llmConfig, questions, userAnswers, story, level, maxTokens = 2048, langId = DEFAULT_LANG_ID, nativeLang = 'en', { gradingContext } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const system = buildGradingSystem(langConfig, level, nativeLangName, { gradingContext });
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
          type:           { type: 'string', description: 'Question type: "mc", "tf", "fb", or "vm"' },
          text:           { type: 'string', description: 'Question in target language' },
          options:        { type: 'array', items: { type: 'string' }, description: 'A-D options for mc type' },
          correct_answer: { type: 'string', description: 'Correct letter (A/B/C/D) for mc, T/F for tf, word for fb' },
          bank:           { type: 'array', items: { type: 'string' }, description: 'Word bank for fb type (includes correct answer + distractors)' },
          pairs:          { type: 'array', items: { type: 'object', properties: { word: { type: 'string' }, definition: { type: 'string' } } }, description: 'Word-definition pairs for vm type' },
        },
        required: ['type', 'text'],
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

export async function generateReader(llmConfig, topic, level, learnedWords = {}, targetChars = 1200, maxTokens = 8192, previousStory = null, langId = DEFAULT_LANG_ID, { signal, structured = false, nativeLang = 'en', vocabFocus, syllabusContext, taughtGrammar, difficultyHint, learnerContext, recentTopics, narrativeContext, narrativeType } = {}) {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const rangePadding = targetChars <= 300 ? 50 : 100;
  const charRange = `${targetChars - rangePadding}-${targetChars + rangePadding}`;
  const system = narrativeType
    ? buildNarrativeReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint, narrativeType, useTargetLang })
    : buildReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint, recentTopics, useTargetLang });
  const userMessage = buildReaderUserMessage(topic, learnedWords, previousStory, langId, { vocabFocus, syllabusContext, taughtGrammar, learnerContext, narrativeContext });

  return await callLLM(llmConfig, system, userMessage, maxTokens, { signal, structured });
}

// ── Syllabus extension ────────────────────────────────────────

export async function extendSyllabus(llmConfig, topic, level, existingLessons, additionalCount = 3, langId = DEFAULT_LANG_ID, nativeLang = 'en') {
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(langId, level);
  const prompt = buildExtendSyllabusPrompt(langConfig, topic, level, existingLessons, additionalCount, nativeLangName, { useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 2048);
  const lessons = parseJSONWithFallback(raw, 'LLM returned an invalid lesson format. Please try again.');

  if (!Array.isArray(lessons)) throw new Error('Expected an array of lessons. Please try again.');
  return { lessons };
}

export async function extendNarrativeSyllabus(llmConfig, syllabus, additionalCount = 10, nativeLang = 'en') {
  const langConfig = getLang(syllabus.langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const useTargetLang = isAdvancedLevel(syllabus.langId, syllabus.level);
  const prompt = buildExtendNarrativeSyllabusPrompt(langConfig, syllabus, additionalCount, nativeLangName, { useTargetLang });

  const raw = await callLLM(llmConfig, '', prompt, 4096);
  const lessons = parseJSONWithFallback(raw, 'LLM returned an invalid narrative lesson format. Please try again.');

  if (!Array.isArray(lessons)) throw new Error('Expected an array of lessons. Please try again.');
  return { lessons };
}
