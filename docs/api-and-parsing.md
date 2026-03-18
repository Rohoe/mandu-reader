# LLM API Integration & Response Parsing

## Provider endpoints

| Provider | Endpoint | Auth | Default Model |
|----------|----------|------|---------------|
| Anthropic | `api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version` + `anthropic-dangerous-direct-browser-access` | `claude-sonnet-4-20250514` |
| OpenAI | `api.openai.com/v1/chat/completions` | `Authorization: Bearer` | `gpt-4o` |
| Gemini | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Key in URL query param | `gemini-2.5-flash` |
| OpenAI-Compatible | Custom `baseUrl` + `/v1/chat/completions` | `Authorization: Bearer` | DeepSeek: `deepseek-chat`, Groq: `llama-3.3-70b-versatile` |

## Call flow

- `callLLM(llmConfig, systemPrompt, userMessage, maxTokens)` → dispatches to `callAnthropic`, `callOpenAI`, `callGemini`
- `callLLMStructured(...)` → `callAnthropicStructured` (tool use), `callOpenAIStructured` (json_schema), `callGeminiStructured` (responseMimeType); OpenAI-compatible falls back to `callLLM`
- `generateReaderStream(llmConfig, ...)` → async generator yielding text chunks via Anthropic SSE streaming (`stream: true`). Anthropic-only; used by `useReaderGeneration` to show a live streaming preview while generating.
- `callLLMChat(llmConfig, systemPrompt, messages[], maxTokens)` → multi-turn chat for tutor feature. Provider-specific message formatting: Anthropic uses `system` param + `messages[]`; OpenAI prepends system message to `messages[]`; Gemini uses `system_instruction` + `contents[]` with user/model roles. Sliding window keeps last 20 messages.
- `callLLMChatStream(llmConfig, ...)` → async generator for streaming chat (Anthropic only; non-streaming fallback for others)
- AbortController with 60s timeout; `generateReader` accepts external signal
- `fetchWithRetry()`: exponential backoff (2 retries for 5xx/429)
- Prompt templates are provider-agnostic, built from `langConfig.prompts`

## Prompt types

- **Syllabus:** Returns JSON `{ summary, lessons[] }` (no markdown fences). Each lesson includes `vocabulary_focus` (3–5 theme keywords) and `difficulty_hint` (`"review"`, `"core"`, or `"stretch"`). Falls back if LLM returns plain array.
- **Reader (text mode):** Structured markdown with sections 1–6; section 5 is ` ```anki-json``` `
- **Reader (structured mode):** JSON matching `READER_JSON_SCHEMA`: `title_target`, `title_en`, `story`, `vocabulary[]`, `questions[]`, `grammar_notes[]`
- `learnedVocabulary` keys passed to LLM — not repeated as new vocab, but 3–5 are actively reinforced in the story
- **Syllabus-aware generation:** When generating within a syllabus, the reader prompt includes: `vocabFocus` (lesson's vocabulary themes), `syllabusContext` (prior lesson summaries and position), `taughtGrammar` (grammar patterns from completed lessons to avoid repetition), and `difficultyHint` (adjusts grammar complexity). Built by `useReaderGeneration` from syllabus + reader state.
- **Tutor:** `buildTutorSystemPrompt()` injects story text, vocabulary list, grammar notes, quiz performance, and syllabus metadata into the system prompt (~1000 tokens). `buildExternalTutorPrompt()` generates a self-contained prompt for pasting into Claude or ChatGPT (copies to clipboard, opens external AI in new tab).

## Response parsing (lib/parser.js)

### Regex parser (default)
- Sections: `### 1. Title`, `### 2. Story`, `### 3. Vocabulary`, `### 4. Comprehension`, `### 5. Anki`
- `#{2,4}\s*N\.` tolerates 2–4 hash marks. Also handles alternative heading formats (CJK headings, unnumbered headings) via fallback extraction.
- `parseWarnings` array in output tracks which fallback paths were used (e.g. "Title extracted via fallback").
- `parseVocabularySection` handles numbered vocab lines (e.g. `1. 词语 ...`) in addition to bullet/dash formats.
- Fallback: raw text with "Regenerate" button
- `parseStorySegments()` → `{ type: 'text'|'bold'|'italic', content }[]`
- `parseQuestions()` → array of question objects with `{ type, text, translation }` plus type-specific fields:
  - `mc`: `{ options, correctAnswer }` — multiple-choice (A/B/C/D)
  - `tf`: `{ correctAnswer }` — true/false (T/F)
  - `fb`: `{ correctAnswer, bank }` — fill-in-the-blank with word bank
  - `vm`: `{ pairs: [{ word, definition }] }` — vocabulary matching
  - `fr`: (no extra fields) — free-response (legacy, kept for backward compat)
- `parseVocabularySection`: Pattern A = `(pinyin)` or `[pinyin]`; Pattern B = no-bracket (backfill from ankiJson). Missing vocab words auto-appended from ankiJson.
- Vocab items: canonical fields (target/romanization/translation) + legacy aliases (chinese/pinyin/english)

### Structured parser (opt-in)
- `normalizeStructuredReader(rawJson, langId)` converts JSON to same shape as regex parser output
- Falls back to regex parser on invalid JSON
- Not supported by OpenAI-compatible endpoints

## Anki export format

- Tab-separated: `Chinese \t Pinyin \t English \t Examples \t Tags`
- Tags: `HSK<level> <Topic_underscored> <YYYY-MM-DD>`
- Filename: `anki_cards_<topic>_HSK<level>_<YYYY-MM-DD>.txt`
- UTF-8 BOM for Excel. Duplicate prevention via `exportedWords` Set.

## Migration

- Legacy single `gradedReader_apiKey` → `providerKeys.anthropic` on first load
- Legacy data missing `langId` → normalized to `'zh'` via `vocabNormalizer.js`
