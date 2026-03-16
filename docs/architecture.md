# Architecture Reference

## File-by-file guide

### `src/context/`

| File | Description |
|------|-------------|
| `AppContext.jsx` | useReducer-based global store + AppProvider. Reducer composed from 8 domain slices in `reducers/`. Persistence extracted to `usePersistence` hook. Test-only exports: `_baseReducer`, `_reducer`, `_DATA_ACTIONS`. |
| `reducers/` | 8 domain slice reducers: `providerReducer`, `syllabusReducer`, `readerReducer`, `vocabularyReducer`, `dataReducer`, `preferencesReducer`, `uiReducer`, `cloudReducer`. Each handles its own action types; composed in AppContext. |
| `usePersistence.js` | Persistence side-effects extracted from AppContext. useEffect hooks keyed to state slices. Uses `mountedRef` to skip initial-render saves. Generated readers use `prevReadersRef` diffing. |
| `useApp.js` | useApp hook (separate file for ESLint fast-refresh rule) |
| `actions.js` | actions() helper factory (separate file for same reason) |

### `src/lib/`

| File | Description |
|------|-------------|
| `languages.js` | Language config registry. Exports `getLang(id)`, `getAllLanguages()`, `getLessonTitle()`, `DEFAULT_LANG_ID`. Each lang: proficiency levels, scriptRegex, fonts, TTS config, romanization loader, decorative chars, prompt fragments. Supports `'zh'`, `'yue'`, `'ko'`. |
| `romanizer.js` | Async romanization loader. Lazy-loads pinyin-pro (zh), to-jyutping (yue), hangul-romanization (ko). Returns `{ romanize(text): string[] }`. |
| `vocabNormalizer.js` | Migration helpers: `normalizeSyllabus()` adds langId + title_target. `normalizeVocabWord()` maps chinese/pinyin/english ↔ target/romanization/translation. |
| `providers.js` | Provider registry. Exports `PROVIDERS`, `getProvider(id)`, `DEFAULT_PROVIDER`. Four providers: anthropic, openai, gemini, openai_compatible (presets: DeepSeek, Groq, custom). |
| `llmConfig.js` | `buildLLMConfig(state)` → `{ provider, apiKey, model, baseUrl }` |
| `api.js` | LLM API calls: `generateSyllabus()`, `generateReader()`, `generateReaderStream()`, `extendSyllabus()`, `gradeAnswers()`. All accept `llmConfig` first, `langId` last. `generateReaderStream()` is an async generator for Anthropic SSE streaming. `callLLM()` dispatches to provider-specific functions. `fetchWithRetry()` for backoff. `callLLMStructured()` for structured output. `buildReaderUserMessage()` accepts syllabus-aware options: `vocabFocus`, `syllabusContext`, `taughtGrammar`. Story continuation uses smart truncation (preserves beginning + end). Exports `isRetryable` for testing. |
| `chatApi.js` | Multi-turn chat API for tutor feature. `callLLMChat()` sends full message array to any provider. `callLLMChatStream()` async generator for Anthropic streaming, falls back to non-streaming for others. Provider message format mapping (Anthropic: system param; OpenAI: system role; Gemini: system_instruction + user/model roles). Sliding window keeps last 20 messages. `buildExternalTutorPrompt()` generates self-contained prompt for pasting into Claude/ChatGPT. |
| `difficultyValidator.js` | `assessDifficulty(vocab, learnedVocabulary, level)` computes new-word ratio and returns an assessment label/class. Used by ReaderHeader to show a difficulty badge. |
| `stats.js` | `computeStats(state)`, `getStreak()`, `getWordsByPeriod()` |
| `storage.js` | localStorage helpers with file fan-out via `setDirectoryHandle()`. Per-reader lazy storage. LRU eviction (>30 cached, >30 days). Provider keys NOT synced to file/cloud. |
| `fileStorage.js` | File System Access API layer. Stores directory handle in IndexedDB. File layout: `graded-reader-syllabi.json`, `graded-reader-readers.json`, `graded-reader-vocabulary.json`, `graded-reader-exported.json`. |
| `parser.js` | Parses LLM markdown → structured data. `normalizeStructuredReader()` for JSON mode. Language-aware via `langConfig.scriptRegex`. Vocab items have both canonical (target/romanization/translation) and legacy (chinese/pinyin/english) fields. |
| `anki.js` | Tab-separated Anki .txt export. UTF-8 BOM. Duplicate prevention via `exportedWords` Set. |
| `supabase.js` | Supabase client singleton |
| `demoReader.js` | Hardcoded HSK 2 demo reader. `DEMO_READER_KEY = 'standalone_demo'`. Injected when no data exists, removed on first generation. |
| `cloudSync.js` | Cloud sync: `signInWithGoogle()`, `signInWithApple()`, `signOut()`, `pushToCloud()`, `pullFromCloud()`. `mergeData()` for union merge. `computeMergeSummary()` for human-readable diffs. `pushReaderToCloud` serialized via promise queue. |

### `src/prompts/`

| File | Function |
|------|----------|
| `syllabusPrompt.js` | `buildSyllabusPrompt(langConfig, topic, level, lessonCount)` — lesson schema includes `vocabulary_focus` and `difficulty_hint` |
| `readerSystemPrompt.js` | `buildReaderSystem(langConfig, level, topic, charRange, targetChars, nativeLangName, { difficultyHint })` — adds reinforcement and difficulty guidance |
| `gradingPrompt.js` | `buildGradingSystem(langConfig, level)` |
| `extendSyllabusPrompt.js` | `buildExtendSyllabusPrompt(langConfig, topic, level, existingLessons, additionalCount)` |
| `tutorPrompt.js` | `buildTutorSystemPrompt(reader, lessonMeta, langConfig, nativeLangName)` — context-rich system prompt for AI tutor with story, vocabulary, grammar, quiz results, syllabus metadata |

### `src/hooks/`

| File | Description |
|------|-------------|
| `useTTS.js` | Voice loading, speech synthesis, per-paragraph speak. Rate = `ttsSpeechRate × langConfig.tts.defaultRate`. |
| `useRomanization.jsx` | Async romanizer loading, `renderChars()` with ruby tags. Parses markdown segments before applying romanization. |
| `useVocabPopover.js` | Vocab map, click handler, popover positioning, close logic |
| `useReaderGeneration.js` | Generate/regenerate API calls + state updates. AbortController for abort-on-unmount. Returns `streamingText` for Anthropic streaming preview. When inside a syllabus, builds cumulative context (vocab focus, prior lessons, taught grammar, difficulty hint) from `syllabus` and `generatedReaders` props. |
| `useTutorChat.js` | Chat state + API hook for tutor feature. Manages messages, streaming text, summary, error state. Persists `chatHistory` and `chatSummary` on the reader object via `SET_READER`. AbortController for cancellation. `sendMessage()`, `generateSummary()`, `clearChat()`, `stopGenerating()`. |
| `useFocusTrap.js` | Focus trap for popovers. Keeps keyboard focus within the active popover until dismissed. |
| `useReadingTimer.js` | Tracks reading time per reader. Starts on mount, pauses on blur/idle, resumes on focus. Stores `readingTime` (seconds) in reader state. |
| `usePWA.js` | PWA install prompt hook. Captures `beforeinstallprompt` event, exposes `canInstall` flag and `promptInstall()` method. |

### `src/i18n/`

| File | Description |
|------|-------------|
| `index.js` | `useT()` hook: reads `state.nativeLang` via `useAppSelector`, returns `t(key, params)`. Fallback chain: current lang → English → raw key. `{param}` interpolation via `replaceAll`. Also exports `getT(nativeLang)` for non-component contexts. |
| `en.js` | English strings — source of truth for all ~400 keys. Flat dot-notation keys grouped by component area (e.g. `'settings.reading.darkMode'`). |
| `zh.js` | Simplified Chinese translations (complete) |
| `yue.js` | Cantonese translations in Traditional Chinese (complete) |
| `ko.js` | Korean translations (complete) |
| `fr.js` | French translations (complete) |
| `es.js` | Spanish translations (complete) |
| `i18n.test.js` | Tests: key coverage across all languages, placeholder preservation, interpolation logic, fallback chain |

## State shape

```js
{
  // Provider config
  apiKey, providerKeys, activeProvider, activeModel,
  customBaseUrl, customModelName, compatPreset,

  // Content
  syllabi: [{ id, topic, level, langId, summary, lessons[], createdAt }],
  syllabusProgress: { [syllabusId]: { lessonIndex, completedLessons[] } },
  standaloneReaders: [{ key, topic, level, langId, createdAt, seriesId?, episodeNumber?, isDemo? }],
  generatedReaders: { [lessonKey]: parsedReaderData },
  learnedVocabulary: { [targetWord]: { romanization, translation, langId, dateAdded, SRS fields... } },
  exportedWords: Set<string>,

  // Reading
  readingTime: { [lessonKey]: seconds },  // accumulated reading time per reader

  // UI
  loading, loadingMessage, error, notification,
  _recentlyDeleted,  // ephemeral, not persisted — holds deleted syllabus/reader data for undo

  // Preferences (persisted, not cleared by CLEAR_ALL_DATA)
  maxTokens, defaultLevel, defaultTopikLevel, defaultYueLevel,
  defaultLevels: { zh, ko, yue, fr, es, en },          // per-language proficiency defaults
  ttsVoiceURIs: { zh, ko, yue, fr, es, en },           // per-language TTS voice URI map
  ttsVoiceURI, ttsKoVoiceURI, ttsYueVoiceURI,          // legacy TTS fields (kept in sync)
  ttsSpeechRate,
  romanizationOn, exportSentenceRom, exportSentenceTrans, useStructuredOutput, newCardsPerDay,
  nativeLang,

  // Storage & sync
  evictedReaderKeys: Set<string>,
  pendingReaders: { [lessonKey]: true },
  learningActivity: [{ type, timestamp, ... }],
  fsInitialized, saveFolder, fsSupported,
  cloudUser, cloudSyncing, cloudLastSynced, lastModified, hasMergeSnapshot,
}
```

## Storage layers

### localStorage (always)
Primary storage. ~5MB limit. Settings shows usage %. LRU eviction for readers.

### File System Access API (opt-in, Chrome/Edge)
Write-through: localStorage first, then async file write. Directory handle stored in IndexedDB. On startup: load handle → verify permission → hydrate via `HYDRATE_FROM_FILES`.

### Cloud sync (opt-in, Supabase)
Auto-merge on startup with undo. Hash-based conflict detection. Pre-merge snapshot for revert. Safety guards: `syncPausedRef`, skip if already synced, signOut before clearAll.

## Multi-language: adding a new language

1. Add config object to `languages.js` (follow zh/yue/ko shape)
2. Install romanization library if needed
3. Add font import to `index.css`
4. Add `[data-lang="xx"]` CSS override block
5. Legacy data without `langId` auto-normalizes to `'zh'`

## Build config

Vite `manualChunks` splits romanization libraries (`pinyin-pro`, `to-jyutping`, `hangul-romanization`) into a separate chunk so they are lazy-loaded only when needed.
