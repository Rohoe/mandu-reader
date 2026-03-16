# Component Reference

## `TopicForm`
Topic input + language selector (pill toggle: 中文 / 粵語 / 한국어) + proficiency level pills. Two modes: syllabus / standalone. Sliders: lesson count (2–12, syllabus), reader length (150–2000 chars, step 50). Generate button disabled without API key. ARIA `role="radiogroup"` on mode, language, and level pill groups; individual pills use `role="radio"` with `aria-checked`.

## `SyllabusPanel`
Left sidebar: syllabus dropdown, lesson list, standalone readers list, progress bar, settings link. Home (⌂) button. Collapsible sections (▾/▸). Cloud sync status in footer. Cards + Stats buttons. Series grouping for standalone readers with `seriesId`. Demo readers show "(sample)" label.

## `SyllabusHome`
Overview page (syllabusView='home'). Topic, HSK badge, date, AI summary, lesson list with completion status. "Add more lessons" panel (slider 2–6). Delete Syllabus with inline confirmation. Fixed LoadingIndicator overlay during loading.

## `ReaderView`
Main content area. Orchestrates hooks: useTTS, useRomanization, useVocabPopover, useReaderGeneration, useSentenceTranslate. Sets `data-lang` attribute. Demo reader detection (dismissible banner, hides Mark Complete/Regenerate). Evicted reader detection with "Restore from backup" button. Mutual exclusion between vocab, selection, and sentence popovers. Shows streaming preview (live text + cursor animation) when Anthropic streaming is active.

## `ReaderHeader`
Extracted from ReaderView. Renders title, proficiency badge, difficulty badge (via `assessDifficulty()`), and title-level TTS button.

## `ReaderActions`
Extracted from ReaderView. Mark Complete, Regenerate, and other action buttons below the reader content.

## `StorySection`
Renders story paragraphs with vocab buttons, TTS click-to-read, popover portal for vocab definitions. Paragraphs are split into clickable sentence spans via `splitParagraphIntoSentences()`. New props: `langId`, `onSentenceClick`, `sentencePopover`, `sentencePopoverRef`, `onSubSelection`, `romanizer`.

## `SentencePopover`
Portal-based popover shown on sentence click. Displays original sentence (selectable), romanization (if enabled), and translation (via Google Translate). Supports word drill-down: drag-select text within the popover to see a sub-translation.

## `VocabularyList`
Collapsible accordion of vocab cards. Props: `renderChars` (ruby romanization), TTS props (`speakText`, `speakingKey`, `ttsSupported`), translation props (`onTranslateExample`, `translatingKey`, `vocabTranslations`). Inline TTS (🔊) and EN buttons when `showParagraphTools` is true.

## `ComprehensionQuestions`
Question list with textarea input + "Grade My Answers" button. Results: per-question score (1–5) + feedback + toggleable suggested answer. Persists userAnswers + gradingResults to reader object. Accepts renderChars, TTS, and translation props.

## `GrammarNotes`
3–5 grammar pattern cards per reader. Each: pattern (target lang), label, explanation, example sentence. Renders nothing if empty.

## `AnkiExportButton`
Shows new/skip counts. Merges grammar cards into export (tagged Grammar). Inline checkboxes for per-language sentence romanization and sentence translation. When sentence translation is ON, batch-translates examples via Google Translate before export. Reads `exportSentenceRom` and `exportSentenceTrans` from state directly.

## `FlashcardReview/`
Modal with daily SRS session. `buildDailySession()` collects due + new cards. Forward and reverse directions with independent SRS tracking. Interval previews below judgment buttons. Missed/almost re-queued. Undo via Ctrl+Z. Per-language sessions (resumable same day, reset at midnight). Language filter pills. Mode tabs switch between standard flashcards and three additional quiz modes:

### `FillBlankMode`
Cloze-deletion quiz. Shows example sentence with target word blanked out. User types the missing word; graded on match.

### `ListeningMode`
Audio-first quiz. Plays TTS for the target word; user types what they hear. Tests listening comprehension and spelling.

### `MatchingMode`
Drag-and-match quiz. Presents a set of target words and translations; user pairs them. Timed, with score tracking.

## `StatsDashboard/`
Modal: vocab growth chart, per-language breakdown, quiz scores, streak, activity counts. Flashcard stats: total reviews, retention rate, mastery breakdown. SRS stats: review forecast chart, retention curve, review heatmap. Reading stats: per-reader reading time, average reading speed. CSS-only charts.

## `Settings`
Tabbed modal (4 tabs). Tab bar uses `role="tablist"` / `role="tab"` with `aria-selected` and keyboard navigation. Each tab is extracted into its own component:
- **`SettingsReadingTab`**: dark mode, romanization, paragraph tools, verbose vocab, reading speed, default levels, TTS voices
- **`SettingsAITab`**: provider pills with key-set indicators, model picker, API key input, base URL
- **`SettingsSyncTab`**: storage meter, backup/restore, cloud sync, "Revert last sync", save folder
- **`SettingsAdvancedTab`**: output tokens slider, structured output toggle, re-parse button, danger zone

## `LoadingIndicator`
Animated ink-wash Chinese characters (读写学文语书).

## `PWABanner`
Dismissible banner prompting users to install the app as a PWA. Uses `usePWA` hook to detect install eligibility. Shows only when `canInstall` is true and user has not dismissed.

## `TutorChat/`
Right-side drawer panel for AI tutor conversation. Desktop: 400px wide, slides in from right. Mobile: full-screen.

### `TutorChat/index.jsx`
Main drawer component. Renders header (title, summary/clear/close buttons), scrollable message area, streaming indicator, input area, and external links. Uses `useTutorChat` hook for state management. "Open in Claude" / "Open in ChatGPT" buttons always shown (copies lesson context to clipboard, opens external AI in new tab). Closes on Escape key or overlay click.

### `ChatMessage`
Single message bubble. User messages: right-aligned, accent background, white text. Assistant messages: left-aligned, elevated background with border.

### `ChatInput`
Textarea with auto-grow + send button. Suggestion chips shown when conversation is empty: "Quiz me on vocab", "Explain the grammar", "Discuss the story", "Summarize my lesson". Enter sends (Shift+Enter for newline).

### `ChatSummary`
Collapsible summary card. Used both inside the chat drawer and as a section in ReaderView (after grammar notes). Shows lesson summary generated by the tutor.

### FAB Button
Floating action button (💬) in ReaderView, `position: fixed; bottom-right`. Opens the tutor chat drawer. Only rendered when a reader is loaded and `onOpenChat` prop is provided.

## `GenerationProgress`
Phase-based progress bar. type='reader' (6 phases, ~30s) or type='syllabus' (4 phases, ~10s). Shows dynamic provider name.
