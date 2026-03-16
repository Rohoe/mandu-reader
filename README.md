# 漫读 — Multi-Language Graded Reader

A single-page web app for generating graded readers in **Mandarin Chinese**, **Cantonese**, **Korean**, **French**, **Spanish**, and **English** using AI. Supports multiple LLM providers: **Anthropic Claude**, **OpenAI (GPT-4o)**, **Google Gemini**, and **OpenAI-compatible** endpoints (DeepSeek, Groq, custom). Designed for HSK, TOPIK, Cantonese, CEFR, and ESL learners who want personalised reading practice with vocabulary tracking and Anki export.

## Features

- **Multi-provider AI** — Choose from Anthropic Claude, OpenAI GPT-4o, Google Gemini, or any OpenAI-compatible endpoint (DeepSeek, Groq, custom). Each provider stores its own API key; switch freely without losing keys. Model picker with curated defaults per provider; collapsed by default, expandable to type any model ID (handles new/deprecated models gracefully)
- **Multi-language support** — Generate readers in Mandarin Chinese (HSK 1–6), Cantonese (YUE 1–6, written Cantonese with jyutping), Korean (TOPIK 1–6), French (CEFR A0–C2), Spanish (CEFR A0–C2), or English (CEFR A0–C2). Select a language via the pill toggle in the sidebar form; content in all languages coexists side-by-side
- **Native language selection** — Choose your explanation language (English, Chinese, Korean, French, Spanish, Japanese) so vocabulary definitions, translations, and grammar notes appear in your native language instead of always in English
- **Syllabus Mode** — Generate a course for any topic with proficiency-level selection, an AI-written summary and a dedicated home page showing all lessons, completion status, and a collapsible "What you've learned" summary aggregating vocabulary, grammar patterns, and total reading across completed lessons
- **Graded Reader Generation** — Stories with bolded vocabulary, level-calibrated grammar. Syllabus lessons use vocabulary focus keywords, cumulative lesson context, progressive difficulty hints (review/core/stretch), and grammar tracking to create a coherent learning progression rather than isolated readings
- **Vocabulary Memory** — Tracks learned words across sessions; new readers avoid repeating them as new vocabulary but actively reinforce 3–5 previously learned words per story
- **Anki Export** — Download flashcard files (.txt) with duplicate prevention; includes both vocabulary cards and grammar pattern cards (tagged `Grammar`)
- **Offline persistence** — All data stored in `localStorage`; pick up where you left off. Automatic LRU eviction frees space when >30 readers are cached (only evicts readers backed up to cloud or file storage); evicted readers show a one-click "Restore from backup" button
- **Grammar Notes** — Each reader includes 3–5 collapsible grammar pattern cards explaining structures used in the story, with examples
- **AI Tutor Chat** — Interactive right-side drawer where you can chat with an AI tutor about your current lesson. Suggestion chips for quick actions (quiz on vocab, explain grammar, discuss the story, summarize lesson). Streaming responses with Anthropic, non-streaming fallback for other providers. Chat history and lesson summaries persist on the reader. "Open in Claude" / "Open in ChatGPT" buttons always available — copies lesson context to clipboard and opens external AI in a new tab
- **Comprehension grading** — Type answers to comprehension questions and get AI-powered feedback with per-question scores; every question includes a toggleable suggested model answer; results persist across sessions
- **Syllabus home page** — Overview of all lessons with completion badges, a summary, Continue CTA, and delete button with confirmation
- **Configurable length** — Sliders for syllabus lesson count (2–12) and reader story length (150–2000 characters). Short readers (≤250 chars) automatically scale down to fewer vocabulary words, questions, and grammar notes — ideal for absolute beginners
- **Dark mode** — Toggle in Settings; persists across sessions. Overrides all colour tokens via `[data-theme="dark"]` on the root element
- **Story continuation** — "Next episode →" button generates a follow-up reader that continues the narrative from the previous story, maintaining characters and setting. Smart truncation preserves both the opening and ending of long stories for better narrative coherence. Continuation chains are grouped as series in the sidebar with episode numbers
- **Flashcard review** — Built-in SRS flashcard system with daily sessions. Forward cards (target→EN) and reverse cards (EN→target) with independent spaced repetition tracking. Reverse cards unlock after a word is reviewed forward at least once. Missed/almost cards are re-queued until all are "Got it". Configurable new cards per day (default 20). SRS interval previews below judgment buttons show upcoming intervals. Romanization ruby annotations on card front when enabled. Undo (Ctrl+Z) restores the previous card. Example sentences shown on card backs. Sessions persisted per-language; resume on the same day, reset at midnight. "New session" resets the new-card budget and shows only never-reviewed cards (skips due cards entirely). Filter by language. Accessible from the sidebar footer or Stats dashboard
- **Demo mode** — New users see a sample HSK 2 reader on first launch. A default free Gemini API key enables basic generation without setup; add your own key for faster responses and higher limits
- **Extend syllabus** — "Add more lessons" panel on the syllabus home page appends 2–6 AI-generated lessons to an existing syllabus
- **Collapsible sidebar sections** — Syllabus lesson list and standalone readers list can be collapsed/expanded via caret buttons in their section headers
- **Text-to-speech** — 🔊 icon button reads the full story aloud; click any paragraph to hear just that sentence. Inline TTS buttons also appear on vocabulary example sentences and comprehension questions when Paragraph Tools is enabled. Separate voice preferences for Chinese, Korean, and Cantonese, configurable in Settings. Adjustable reading speed (0.5×–2.0×) via slider in Settings. Auto-selects the best available voice for each language (Chinese: Google neural, macOS Tingting/Meijia; Korean: Google, Yuna)
- **Click-to-define** — Vocabulary words from the word list are highlighted and underlined in the story; click them to see a popover with romanization and English definition. Toggle off by clicking again, pressing Escape, or clicking elsewhere
- **Romanization toggle** — Persistent setting in Settings to show romanization above every character using `<ruby>` tags in the story, comprehension questions, vocabulary list (word headers and example sentences), and grammar notes (patterns and examples). Powered by `pinyin-pro` for Chinese, `to-jyutping` for Cantonese, `hangul-romanization` for Korean. Not applicable for Latin-script languages (French, Spanish, English)
- **Verbose Vocabulary** — Toggle in Settings to include English translations of example sentences in Anki flashcard exports; translations are fetched on-demand via Google Translate at export time and cached for reuse
- **Disk persistence** — Optionally save all data as JSON files to a folder on your computer (Chrome/Edge only)
- **Cloud Sync** — Sign in with Google or Apple to push/pull all your data to/from Supabase. Manual sync via explicit Push/Pull buttons in Settings; API key stays local. The sidebar footer shows sync status: signed-in state, "Synced"/"Unsynced" indicator based on whether local data has changed since the last push
- **Learning Stats Dashboard** — Track vocabulary growth, quiz scores, day streaks, and per-language breakdowns. Flashcard stats: total reviews, reviews today, retention rate, flashcard streak, and mastery breakdown (mastered/learning/new). CSS-only bar charts show words learned over time. Activity log stashes entries older than 90 days to avoid memory bloat; "Load full history" button in Stats. Accessible via the "Stats" button in the sidebar footer
- **Structured output** — Opt-in setting (Settings → Advanced) to use provider-native structured output (Anthropic tool use, OpenAI JSON schema, Gemini response schema) for more reliable parsing. Default off; OpenAI-compatible endpoints fall back to the standard regex parser
- **PWA / Offline Support** — Install the app on your home screen; cached readers and the full UI work offline. Service worker powered by Workbox with runtime caching for Google Fonts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get an API key

Get an API key from your preferred provider:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) (key starts with `sk-ant-`)
- **OpenAI:** [platform.openai.com](https://platform.openai.com) (key starts with `sk-`)
- **Google Gemini:** [aistudio.google.com](https://aistudio.google.com) (key starts with `AIza`)
- **DeepSeek / Groq / Other:** Get a key from your chosen provider

> No `.env` file is required. Open Settings in the app to select your provider and paste your API key. Each provider stores its own key in your browser's `localStorage` — keys never leave your device except for calls to the selected provider's API.

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Accessing from your phone or tablet

To open the app on a mobile device on the same Wi-Fi network, start the dev server with the `--host` flag:

```bash
npm run dev -- --host
```

Vite will print a **Network** URL like `http://192.168.x.x:5173`. Open that URL on your phone.

> Your computer and mobile device must be on the same Wi-Fi network. You may also need to allow port 5173 through your firewall if the page doesn't load.

The app is optimised for iPhone and Android: safe area insets keep the UI clear of the notch/Dynamic Island, tap targets meet the 44×44px minimum, and body scroll is locked when the sidebar is open.

## Usage

1. **Select a provider and enter your API key** in Settings (first run only). The default model is pre-selected; click "Change" to pick a different one or type any model ID
2. **Choose "Course Syllabus"** — enter a topic (e.g. "Chinese business culture") and HSK level, then click "Generate Syllabus"
3. **Click a lesson** in the sidebar to generate its reader
4. **Read** the story; bolded words are new vocabulary
5. **Expand vocabulary cards** to see pinyin, definitions, example sentences, and italic usage notes explaining each example's grammar or nuance
6. **Export to Anki** — click the export button to download a `.txt` file. Already-exported words are skipped automatically; re-download at any time with the "Re-download Cards" button.

Alternatively, use **Single Reader** mode to generate a one-off story without a syllabus.

### Adjusting output length

Use the sliders in the sidebar form to control:
- **Lessons** (syllabus mode) — how many lessons to generate (2–12, default 6)
- **Reader Length** — target story length in characters (150–2000, default 1200). Readers ≤250 chars use fewer vocab words (3–5), questions (2–3), and grammar notes (1–2)

To fix truncated readers, open **Settings → Advanced → API Output Tokens** and drag the slider up. The default is 8,192 tokens. Values above 8,192 may require an API tier that supports extended output.

### Optional: Save to disk

In the **Settings** panel (⚙ icon), the **Save Folder** section lets you pick a folder on your computer. Once set, all data (syllabus, readers, vocabulary, exported words) is written to JSON files in that folder on every change, in addition to `localStorage`. This survives clearing browser data and works across machines if you sync the folder.

> Requires Chrome or Edge. Firefox and Safari do not support the File System Access API.

### Optional: Cloud sync via Supabase

The **Cloud Sync** section in Settings lets you push/pull all app data to/from a personal Supabase database.

**Prerequisites (one-time setup):**
1. Create a free project at [supabase.com](https://supabase.com)
2. Enable **Google** and/or **Apple** OAuth in Authentication → Providers
3. Add `http://localhost:5173` (and your production URL) to Authentication → URL Configuration → Redirect URLs
4. Run the following SQL in the SQL editor:

```sql
CREATE TABLE user_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  syllabi JSONB DEFAULT '[]',
  syllabus_progress JSONB DEFAULT '{}',
  standalone_readers JSONB DEFAULT '[]',
  generated_readers JSONB DEFAULT '{}',
  learned_vocabulary JSONB DEFAULT '{}',
  exported_words JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own data"
  ON user_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

5. Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Once configured, open Settings → Cloud Sync → sign in with Google or Apple. Use **Push to cloud ↑** to upload your data, and **Pull from cloud ↓** on another device to download it.

> Your API key is never synced to the cloud — it stays local to each device.

## Security note

Your API keys are stored in plain text in `localStorage` and sent directly to the selected provider's API from your browser. Keys are never synced to file storage or the cloud. This is acceptable for personal use. Do not share the URL with others if you have keys pre-filled.

## Testing

```bash
npm test              # run all unit tests (Vitest)
npm run test:watch    # watch mode
npm run test:coverage # with V8 coverage
npm run test:e2e      # run E2E tests (Playwright)
npm run test:e2e:ui   # Playwright UI mode
```

- **515 unit tests** (Vitest) — parser, reducer, stats, anki, storage, cloudSync, useReaderGeneration, difficultyValidator, chatApi, tutorPrompt, and more
- **22 E2E tests** (Playwright) — demo reader, settings, reader generation, flashcards, mobile layout

## Tech stack

- React 18 + Vite 5
- No backend required
- Testing: Vitest + Playwright
- Fonts: Noto Serif SC (Chinese), Noto Serif TC (Cantonese), Noto Serif KR (Korean), Cormorant Garamond (Latin-script languages)
- Zero UI framework dependencies — pure CSS with custom design tokens
- Language-specific libraries loaded lazily (`pinyin-pro` for Chinese, `to-jyutping` for Cantonese, `hangul-romanization` for Korean; Latin-script languages need no romanization library)

## Building for production

```bash
npm run build
```

The output in `dist/` can be served from any static host (Netlify, Vercel, GitHub Pages, etc.). Users will still need to enter their own API key.

## Deploying to Vercel

The app is a static SPA — no backend required. Vercel auto-detects Vite.

### 1. Import the repository

Go to [vercel.com](https://vercel.com) → **New Project** → import `Rohoe/mandarin-graded-reader` from GitHub. Vercel auto-detects the Vite framework; no manual config needed.

Alternatively, use the CLI:

```bash
npm i -g vercel
vercel
```

### 2. Add environment variables

In the Vercel project dashboard → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

Set scope to **Production** (and Preview/Development if desired).

> `VITE_ANTHROPIC_API_KEY` is **not** needed — the API key is entered by users at runtime and stored in localStorage.

### 3. Whitelist the Vercel domain in Supabase

In Supabase dashboard → **Authentication → URL Configuration**, add your Vercel URL to **Redirect URLs**:

```
https://your-app.vercel.app
```

If you use a custom domain, add that as well. This is required for Google/Apple OAuth to redirect back correctly.

### 4. Deploy

Push a commit to `main` — Vercel deploys automatically. Or trigger manually:

```bash
vercel --prod
```

### Verification

1. Open the deployed URL
2. Open Settings → AI Provider, select a provider, and enter a valid API key
3. Generate a reader — confirms browser-to-API calls work
4. (Optional) Sign in with Google/Apple in Settings → Cloud Sync — confirms OAuth redirect works
