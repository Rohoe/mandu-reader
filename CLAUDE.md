# CLAUDE.md — Multi-Language Graded Reader App

Single-page React + Vite app that generates graded readers in **Mandarin Chinese**, **Cantonese**, **Korean**, **French**, **Spanish**, and **English** using LLM APIs (Anthropic, OpenAI, Gemini, OpenAI-compatible). Users pick a target language, native language, and proficiency level; the app generates stories with vocabulary, comprehension questions, and Anki exports.

## Running the app

```bash
npm install        # first time only
npm run dev        # http://localhost:5173
npm run build      # production build
npm test           # unit tests (Vitest, 782 tests)
npm run test:e2e   # E2E tests (Playwright, 48 tests across 2 projects)
```

No `.env` needed for basic use. Users add their own API key in Settings. Cloud sync requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

## Key directories

```
src/
  App.jsx              Root layout, UI-only state (sidebar, modals, activeSyllabusId, standaloneKey, syllabusView). Default view: 'dashboard' (Home page)
  context/             useReducer global store (AppContext.jsx), useApp hook, actions factory, reducers/ (10 domain slices)
  i18n/                UI string translations: useT() hook, en/zh/yue/ko/fr/es language files
  lib/                 Core logic: api.js, apiUtils.js, chatApi.js, parser.js, storage.js, readerStorage.js, fileStorage.js, languages.js, nativeLanguages.js, providers.js, llmConfig.js, cloudSync.js, supabase.js, anki.js, ankiApkg.js, stats.js, translate.js, vocabMapper.js, vocabNormalizer.js, grammarMapper.js, sentenceSplitter.js, romanizer.js, demoReader.js, learningPathSchema.js, nextActions.js, milestones.js
  prompts/             LLM prompt builders (syllabus, reader, grading, extend, tutor, learningPath, narrative, pathUnit, portable)
  hooks/               useTTS, useRomanization, useVocabPopover, useReaderGeneration, useTutorChat, useFocusTrap, useReadingTimer, usePWA, useBufferedMarkdown, useFlashcardKeyboard, useFlashcardSession, useQuestionTranslation, useSentenceTranslate, useStreamAccumulator, useTextSelection, usePopoverDismissal, useMilestoneCheck
  components/          UI components (see docs/components.md for details)
e2e/                   Playwright E2E specs + fixtures
```

## Architecture highlights

- **Multi-language:** Config registry in `src/lib/languages.js` — each lang defines proficiency levels, script regex, fonts, TTS, romanization, prompt fragments. All API/parser/export functions accept `langId`. CJK langs (zh, yue) use character-based splitting; syllabic (ko) and Latin-script langs (fr, es, en) use word-based splitting.
- **Native language:** `src/lib/nativeLanguages.js` — configurable explanation language (English, Chinese, Korean, French, Spanish, Japanese). Prompts, vocab definitions, and translations use the learner's native language instead of always English.
- **UI i18n:** `src/i18n/` — lightweight custom `useT()` hook reads `state.nativeLang` and returns a `t(key, params)` function. ~700 keys across 6 language files (en, zh, yue, ko, fr, es). Fallback chain: current lang → English → raw key. Simple `{param}` interpolation. No external library.
- **Multi-provider LLM:** Registry in `src/lib/providers.js`. `callLLM()` dispatches to provider-specific functions. `buildLLMConfig(state)` from `llmConfig.js` builds config from state.
- **State:** useReducer in AppContext.jsx. Reducer split into 10 domain slices in `src/context/reducers/` (data, syllabus, reader, vocabulary, grammar, preferences, provider, cloud, ui, learningPath). Persistence extracted to `usePersistence.js`. Test-only exports: `_baseReducer`, `_reducer`, `_DATA_ACTIONS`.
- **Storage:** localStorage (primary) + opt-in File System Access API (Chrome) + Supabase cloud sync with auto-merge and undo.
- **Parsing:** `vocab-json` block is primary vocab format (single source of truth); legacy markdown+anki-json fallback in `parser.js`. Structured JSON parser (opt-in) via `normalizeStructuredReader()`.
- **Syllabus→Reader connection:** Syllabus lesson metadata (`vocabulary_focus`, `difficulty_hint`) is threaded into reader prompts. `useReaderGeneration` builds cumulative context (prior lesson summaries, taught grammar patterns) so each lesson builds on previous ones. `SyllabusHome` aggregates a learning summary from completed readers.
- **Streaming:** Anthropic provider supports streaming responses via `generateReaderStream()` async generator. Text streams progressively to UI with debounced markdown rendering (`useBufferedMarkdown`), then parses on completion.
- **AI Tutor Chat:** `src/lib/chatApi.js` provides multi-turn `callLLMChat`/`callLLMChatStream` for all providers. `src/prompts/tutorPrompt.js` builds context-rich system prompts. `src/hooks/useTutorChat.js` manages chat state, persists `chatHistory`/`chatSummary` on reader objects via `SET_READER`. "Open in Claude/ChatGPT" always available (copies lesson context to clipboard). UI in `src/components/TutorChat/`.
- **Grammar SRS:** `grammarReducer.js` + `grammarMapper.js` manage grammar pattern spaced repetition. Grammar cards extracted from reader grammar notes with independent SRS tracking.
- **Flashcard modes:** `FlashcardReview/` supports multiple modes: SRS Review (vocab + grammar), Quiz Mix, Practice, Sentence Builder, Context Clue, Reverse Listening. Mode picker UI replaced the previous tab-based interface. `useFlashcardSession` manages session state. Adaptive SRS uses `leechFactor` (0.5–1.0 based on lapses) and differentiated `almost` handling.
- **Grammar active recall:** `GrammarReviewMode` supports 3 modes: Classic (flip), Cloze (fill blanks via `grammarCloze.js`), Build (arrange tiles). Mode picker UI in grammar review.
- **Difficulty feedback:** After completing a reader, users rate difficulty (Too Easy / Just Right / Too Difficult). Per-language rolling window of 10 stored in `difficultyFeedback`. `computeDifficultyCalibration()` in `stats.js` produces an exponential-decay-weighted offset injected into reader prompts via `buildLearnerContext`.
- **Smart next actions:** `src/lib/nextActions.js` returns ranked suggestions (due flashcards, continue lesson, streak protection, struggling vocab, create new). Shown on dashboard (`HomeView`) and post-lesson (`ReaderActions`).
- **Milestone celebrations:** `src/lib/milestones.js` detects vocab thresholds, streak milestones, and firsts. `useMilestoneCheck` hook manages queue + auto-dismiss. Non-blocking overlay via `MilestoneCelebration` component.
- **Home dashboard:** `HomeView/` component serves as the default landing page (`syllabusView: 'dashboard'`). Shows weekly reading goals, smart next actions, reading session logs, and activity overview. Reading sessions tracked via `useReadingTimer`.
- **Inline topic suggestions:** LLM generates topic suggestions during syllabus creation, shown as clickable chips.
- **Comprehension translation:** `useQuestionTranslation` hook + "Translate All" toggle translates comprehension questions via Google Translate.
- **Learning Paths:** Multi-unit curricula designed at a high level, then expanded unit-by-unit into syllabi. `learningPathReducer` + `learningPathSchema.js` manage state/validation. `learningPathPrompt.js` generates 6–15 unit blueprints from learner profile. `pathUnitSyllabusPrompt.js` expands units into syllabi with overlap prevention (covered vocab/topics/grammar). `portablePrompt.js` exports LLM-friendly prompts for external AI design.
- **Narrative mode:** Story-arc syllabi for literature/history. `narrativeSyllabusPrompt.js` structures source material into chaptered lessons with character continuity. `narrativeReaderPrompt.js` generates individual chapters with tiered narrative context (deep/medium/compressed). `extendNarrativeSyllabusPrompt.js` continues arcs.

## Lesson keys

- Syllabus lessons: `lesson_<syllabusId>_<lessonIndex>`
- Standalone readers: `standalone_<timestamp>`
- UI state (`activeSyllabusId`, `standaloneKey`, `syllabusView`) lives in App.jsx, persisted via `saveLastSession()`. `syllabusView` values: `'dashboard'` (Home), `'home'` (syllabus overview), `'lesson'` (reader view).

## Design system

CSS custom properties in `index.css`. Key tokens: `--color-bg` (#FAF8F5), `--color-accent` (#4A7C7E), `--font-chinese`, `--font-target` (overridden by `[data-lang]`). Dark mode via `[data-theme="dark"]`. Two-column desktop (280px sidebar), single-column mobile (≤768px).

## Testing

Unit tests colocated with source (`*.test.js`). E2E in `e2e/` with Desktop Chrome + iPhone 14 projects (9 spec files, 48 tests total). API mocking via `page.route()`. Test helpers in `e2e/helpers/appHelpers.js`.

## Detailed documentation

For in-depth reference, see the docs in `docs/`:
- **[docs/architecture.md](docs/architecture.md)** — File-by-file architecture, state shape, storage/sync details
- **[docs/components.md](docs/components.md)** — Component descriptions and prop contracts
- **[docs/api-and-parsing.md](docs/api-and-parsing.md)** — LLM provider integration, prompt system, response parsing
- **[docs/deployment.md](docs/deployment.md)** — Vercel deployment, testing infrastructure, known limitations

## Keeping docs current

When making changes that affect architecture, components, APIs, or state shape, update the relevant `docs/` file and `README.md` in the same commit. This CLAUDE.md should stay concise (~60 lines); put details in `docs/`.
