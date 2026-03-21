/**
 * Storage layer for all persisted app state.
 *
 * Strategy:
 *  - localStorage is always written (fast, synchronous, works everywhere)
 *  - When a FileSystemDirectoryHandle is registered via setDirectoryHandle(),
 *    every write also fans out to the corresponding JSON file (async, fire-and-forget)
 *  - On startup, AppContext reads from localStorage immediately, then
 *    optionally hydrates from files if a saved handle is found in IndexedDB
 */

import { writeJSON, FILES } from './fileStorage';
import { setReaderDirHandle, loadReaderIndex, loadAllReaders, saveReader, deleteReader, saveReaderSafe, loadReader, clearReaders, loadEvictedReaderKeys, saveEvictedReaderKeys, unmarkEvicted, evictStaleReaders } from './readerStorage';

// Re-export reader operations for backward compatibility
export { loadReaderIndex, loadAllReaders, saveReader, deleteReader, saveReaderSafe, loadReader, clearReaders, loadEvictedReaderKeys, saveEvictedReaderKeys, unmarkEvicted, evictStaleReaders };

// ── Module-level directory handle ─────────────────────────────
// Set by AppContext after permission is verified on startup.

let _dirHandle = null;

export function setDirectoryHandle(handle) {
  _dirHandle = handle;
  setReaderDirHandle(handle);
}

export function getDirectoryHandle() {
  return _dirHandle;
}

// ── localStorage key constants ────────────────────────────────

const KEYS = {
  API_KEY:            'gradedReader_apiKey',
  SYLLABI:            'gradedReader_syllabi',
  SYLLABUS_PROGRESS:  'gradedReader_syllabusProgress',
  STANDALONE_READERS: 'gradedReader_standaloneReaders',
  READERS:            'gradedReader_readers',           // legacy monolithic key
  READER_INDEX:       'gradedReader_readerIndex',       // per-reader index
  VOCABULARY:         'gradedReader_learnedVocabulary',
  EXPORTED:           'gradedReader_exportedWords',
  MAX_TOKENS:         'gradedReader_maxTokens',
  DEFAULT_LEVEL:      'gradedReader_defaultLevel',
  DEFAULT_TOPIK_LEVEL: 'gradedReader_defaultTopikLevel',
  DEFAULT_YUE_LEVEL:   'gradedReader_defaultYueLevel',
  DARK_MODE:          'gradedReader_darkMode',
  TTS_VOICE_URI:      'gradedReader_ttsVoiceURI',
  TTS_KO_VOICE_URI:   'gradedReader_ttsKoVoiceURI',
  TTS_YUE_VOICE_URI:  'gradedReader_ttsYueVoiceURI',
  TTS_VOICE_URIS:     'gradedReader_ttsVoiceURIs',
  CLOUD_LAST_SYNCED:  'gradedReader_cloudLastSynced',
  VERBOSE_VOCAB:      'gradedReader_verboseVocab',  // legacy, migrated to new keys
  EXPORT_SENTENCE_ROM:   'gradedReader_exportSentenceRom',
  EXPORT_SENTENCE_TRANS: 'gradedReader_exportSentenceTrans',
  STRUCTURED_OUTPUT:  'gradedReader_structuredOutput',
  LEARNING_ACTIVITY:  'gradedReader_learningActivity',
  PROVIDER_KEYS:      'gradedReader_providerKeys',
  ACTIVE_PROVIDER:    'gradedReader_activeProvider',
  ACTIVE_MODEL:       'gradedReader_activeModel',
  CUSTOM_BASE_URL:    'gradedReader_customBaseUrl',
  CUSTOM_MODEL_NAME:  'gradedReader_customModelName',
  GRADING_MODELS:     'gradedReader_gradingModels',
  COMPAT_PRESET:      'gradedReader_compatPreset',
  TTS_SPEECH_RATE:    'gradedReader_ttsSpeechRate',
  ROMANIZATION_ON:    'gradedReader_romanizationOn',
  TRANSLATE_BUTTONS:  'gradedReader_translateButtons',
  TRANSLATE_QUESTIONS: 'gradedReader_translateQuestions',
  EVICTED_READER_KEYS: 'gradedReader_evictedReaderKeys',
  NEW_CARDS_PER_DAY:   'gradedReader_newCardsPerDay',
  GRAMMAR:             'gradedReader_learnedGrammar',
  FLASHCARD_SESSION:   'gradedReader_flashcardSession',
  READING_TIME:        'gradedReader_readingTime',
  NATIVE_LANG:         'gradedReader_nativeLang',
  READING_TIME_LOG:    'gradedReader_readingTimeLog',
  WEEKLY_GOALS:        'gradedReader_weeklyGoals',
};

const READER_KEY_PREFIX = 'gradedReader_reader_';

// ── Generic localStorage helpers ──────────────────────────────

export function isStorageAvailable() {
  try {
    const key = '__storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] localStorage write failed:', e);
  }
}

// Fan out to file if a directory handle is registered.
function saveWithFile(lsKey, value, fileKey) {
  save(lsKey, value);
  if (_dirHandle && fileKey) {
    writeJSON(_dirHandle, FILES[fileKey], buildFilePayload(fileKey, value))
      .catch(e => console.warn('[storage] file write failed:', fileKey, e));
  }
  return value;
}

// Build file payload — syllabi file holds syllabi + progress + standaloneReaders together.
function buildFilePayload(fileKey, newValue) {
  if (fileKey === 'syllabi') {
    return {
      syllabi:           newValue ?? load(KEYS.SYLLABI, []),
      syllabusProgress:  load(KEYS.SYLLABUS_PROGRESS, {}),
      standaloneReaders: load(KEYS.STANDALONE_READERS, []),
    };
  }
  return newValue;
}

function saveSyllabiFile() {
  if (_dirHandle) {
    writeJSON(_dirHandle, FILES.syllabi, {
      syllabi:           load(KEYS.SYLLABI, []),
      syllabusProgress:  load(KEYS.SYLLABUS_PROGRESS, {}),
      standaloneReaders: load(KEYS.STANDALONE_READERS, []),
    }).catch(e => console.warn('[storage] file write failed: syllabi', e));
  }
}

// ── API Key ───────────────────────────────────────────────────
// Deliberately NOT synced to file — key stays local only.

export function saveApiKey(key) {
  save(KEYS.API_KEY, key);
}

export function loadApiKey() {
  return load(KEYS.API_KEY, '');
}

export function clearApiKey() {
  localStorage.removeItem(KEYS.API_KEY);
}

// ── Provider Keys (multi-LLM) ─────────────────────────────────
// Deliberately NOT synced to file or cloud — keys stay local only.

export function loadProviderKeys() {
  let keys = load(KEYS.PROVIDER_KEYS, null);
  if (!keys) {
    // Migrate from old single apiKey if it exists
    const oldKey = load(KEYS.API_KEY, '');
    keys = { anthropic: oldKey || '', openai: '', gemini: '', openai_compatible: '' };
    if (oldKey) {
      save(KEYS.PROVIDER_KEYS, keys);
      localStorage.removeItem(KEYS.API_KEY);
    }
  }
  return keys;
}

export function saveProviderKeys(keys) {
  save(KEYS.PROVIDER_KEYS, keys);
}

export function loadActiveProvider() {
  return load(KEYS.ACTIVE_PROVIDER, 'anthropic');
}

export function saveActiveProvider(id) {
  save(KEYS.ACTIVE_PROVIDER, id);
}

export function loadActiveModels() {
  const map = load(KEYS.ACTIVE_MODEL, null);
  if (map && typeof map === 'object' && !Array.isArray(map)) return map;
  // Migrate from old single-string activeModel
  const legacy = typeof map === 'string' ? map : null;
  const fresh = { anthropic: null, openai: null, gemini: null, openai_compatible: null };
  if (legacy) {
    // Assign legacy model to current active provider (best guess)
    const provider = loadActiveProvider();
    fresh[provider] = legacy;
    save(KEYS.ACTIVE_MODEL, fresh);
  }
  return fresh;
}

export function saveActiveModels(map) {
  save(KEYS.ACTIVE_MODEL, map);
}

export function loadCustomBaseUrl() {
  return load(KEYS.CUSTOM_BASE_URL, '');
}

export function saveCustomBaseUrl(url) {
  save(KEYS.CUSTOM_BASE_URL, url);
}

export function loadCustomModelName() {
  return load(KEYS.CUSTOM_MODEL_NAME, '');
}

export function saveCustomModelName(name) {
  save(KEYS.CUSTOM_MODEL_NAME, name);
}

// ── Grading models (per-provider) ─────────────────────────────

export function loadGradingModels() {
  return load(KEYS.GRADING_MODELS, { anthropic: null, openai: null, gemini: null, openai_compatible: null });
}

export function saveGradingModels(map) {
  save(KEYS.GRADING_MODELS, map);
}

export function loadCompatPreset() {
  return load(KEYS.COMPAT_PRESET, 'deepseek');
}

export function saveCompatPreset(preset) {
  save(KEYS.COMPAT_PRESET, preset);
}

// ── Syllabi ───────────────────────────────────────────────────

export function loadSyllabi() {
  // Migration: convert old single-syllabus format if present
  const oldSyllabus = load('gradedReader_syllabus', null);
  if (oldSyllabus) {
    const oldIndex = load('gradedReader_lessonIndex', 0);
    const migrated = [{
      id:        'migrated_' + Date.now().toString(36),
      topic:     oldSyllabus.topic,
      level:     oldSyllabus.level,
      lessons:   oldSyllabus.lessons || [],
      createdAt: Date.now(),
    }];
    save(KEYS.SYLLABI, migrated);
    // Migrate progress
    const progress = load(KEYS.SYLLABUS_PROGRESS, {});
    progress[migrated[0].id] = { lessonIndex: oldIndex, completedLessons: [] };
    save(KEYS.SYLLABUS_PROGRESS, progress);
    // Remove old keys
    localStorage.removeItem('gradedReader_syllabus');
    localStorage.removeItem('gradedReader_lessonIndex');
    return migrated;
  }
  return load(KEYS.SYLLABI, []);
}

export function saveSyllabi(arr) {
  save(KEYS.SYLLABI, arr);
  saveSyllabiFile();
}

// ── Syllabus Progress ─────────────────────────────────────────

export function loadSyllabusProgress() {
  return load(KEYS.SYLLABUS_PROGRESS, {});
}

export function saveSyllabusProgress(map) {
  save(KEYS.SYLLABUS_PROGRESS, map);
  saveSyllabiFile();
}

// ── Standalone Readers ────────────────────────────────────────

export function loadStandaloneReaders() {
  return load(KEYS.STANDALONE_READERS, []);
}

export function saveStandaloneReaders(arr) {
  save(KEYS.STANDALONE_READERS, arr);
  saveSyllabiFile();
}

// ── Learned Vocabulary ────────────────────────────────────────

export function loadLearnedVocabulary() {
  return load(KEYS.VOCABULARY, {});
}

export function addLearnedVocabulary(wordList) {
  const existing = loadLearnedVocabulary();
  const now = new Date().toISOString();
  for (const word of wordList) {
    const key = word.target || word.chinese || word.korean || '';
    if (key && !existing[key]) {
      existing[key] = {
        pinyin:    word.romanization || word.pinyin  || '',
        english:   word.translation  || word.english || '',
        langId:    word.langId  || undefined,
        dateAdded: now,
      };
    }
  }
  saveWithFile(KEYS.VOCABULARY, existing, 'vocabulary');
  return existing;
}

/**
 * Merge vocabulary in-memory without saving (for pure reducer).
 */
export function mergeVocabulary(existing, wordList) {
  const merged = { ...existing };
  const now = new Date().toISOString();
  for (const word of wordList) {
    const key = word.target || word.chinese || word.korean || '';
    if (key && !merged[key]) {
      merged[key] = {
        pinyin:    word.romanization || word.pinyin  || '',
        english:   word.translation  || word.english || '',
        langId:    word.langId  || undefined,
        dateAdded: now,
        // SRS defaults
        interval:    0,
        ease:        2.5,
        nextReview:  null,
        reviewCount: 0,
        lapses:      0,
        // Example sentences from reader (if available)
        ...(word.exampleSentence ? { exampleSentence: word.exampleSentence } : {}),
        ...(word.exampleSentenceTranslation ? { exampleSentenceTranslation: word.exampleSentenceTranslation } : {}),
        ...(word.exampleExtra ? { exampleExtra: word.exampleExtra } : {}),
        ...(word.exampleExtraTranslation ? { exampleExtraTranslation: word.exampleExtraTranslation } : {}),
      };
    }
  }
  return merged;
}

export function saveLearnedVocabulary(vocab) {
  saveWithFile(KEYS.VOCABULARY, vocab, 'vocabulary');
}

/**
 * Merge exported words in-memory without saving (for pure reducer).
 */
export function mergeExportedWords(existing, newWords) {
  const merged = new Set(existing);
  for (const w of newWords) merged.add(w);
  return merged;
}

export function saveExportedWordsFull(wordSet) {
  const arr = [...wordSet];
  saveWithFile(KEYS.EXPORTED, arr, 'exported');
}

export function clearLearnedVocabulary() {
  localStorage.removeItem(KEYS.VOCABULARY);
  if (_dirHandle) {
    writeJSON(_dirHandle, FILES.vocabulary, {})
      .catch(e => console.warn('[storage] file write failed: vocabulary', e));
  }
}

// ── Exported Words ────────────────────────────────────────────

export function loadExportedWords() {
  return new Set(load(KEYS.EXPORTED, []));
}

export function addExportedWords(wordSet) {
  const existing = loadExportedWords();
  for (const w of wordSet) existing.add(w);
  const arr = [...existing];
  saveWithFile(KEYS.EXPORTED, arr, 'exported');
  return existing;
}

export function clearExportedWords() {
  localStorage.removeItem(KEYS.EXPORTED);
  if (_dirHandle) {
    writeJSON(_dirHandle, FILES.exported, [])
      .catch(e => console.warn('[storage] file write failed: exported', e));
  }
}

// ── Learned Grammar ──────────────────────────────────────────

export function loadLearnedGrammar() {
  return load(KEYS.GRAMMAR, {});
}

/**
 * Merge grammar in-memory without saving (for pure reducer).
 */
export function mergeGrammar(existing, noteList) {
  const merged = { ...existing };
  const now = new Date().toISOString();
  for (const note of noteList) {
    const key = `${note.langId}::${note.pattern}`;
    if (key && !merged[key]) {
      merged[key] = {
        pattern: note.pattern,
        label: note.label || '',
        explanation: note.explanation || '',
        example: note.example || '',
        langId: note.langId,
        dateAdded: now,
        interval: 0, ease: 2.5, nextReview: null, reviewCount: 0, lapses: 0,
      };
    }
  }
  return merged;
}

export function saveLearnedGrammar(grammar) {
  saveWithFile(KEYS.GRAMMAR, grammar, 'grammar');
}

// ── Grammar session (ephemeral, no file fanout) ────────────

export function loadGrammarSession(langId) {
  return load('gradedReader_grammarSession_' + langId, null);
}

export function saveGrammarSession(session, langId) {
  save('gradedReader_grammarSession_' + langId, session);
}

// ── Max tokens preference ─────────────────────────────────────

export function loadMaxTokens() {
  return load(KEYS.MAX_TOKENS, 8192);
}

export function saveMaxTokens(n) {
  save(KEYS.MAX_TOKENS, n);
}

// ── Default HSK level preference ──────────────────────────────

export function loadDefaultLevel() {
  return load(KEYS.DEFAULT_LEVEL, 3);
}

export function saveDefaultLevel(n) {
  save(KEYS.DEFAULT_LEVEL, n);
}

// ── Default TOPIK level preference ───────────────────────────

export function loadDefaultTopikLevel() {
  return load(KEYS.DEFAULT_TOPIK_LEVEL, 2);
}

export function saveDefaultTopikLevel(n) {
  save(KEYS.DEFAULT_TOPIK_LEVEL, n);
}

// ── Default YUE level preference ─────────────────────────────

export function loadDefaultYueLevel() {
  return load(KEYS.DEFAULT_YUE_LEVEL, 2);
}

export function saveDefaultYueLevel(n) {
  save(KEYS.DEFAULT_YUE_LEVEL, n);
}

// ── Default levels map (per-language) ─────────────────────────

const DEFAULT_LEVELS_KEY = 'gradedReader_defaultLevels';
const DEFAULT_LEVELS_DEFAULTS = { zh: 3, ko: 2, yue: 2, fr: 2, es: 2, en: 2 };

export function loadDefaultLevels() {
  // Migrate from old per-language keys if map doesn't exist yet
  let map = load(DEFAULT_LEVELS_KEY, null);
  if (!map) {
    map = {
      zh: load(KEYS.DEFAULT_LEVEL, 3),
      ko: load(KEYS.DEFAULT_TOPIK_LEVEL, 2),
      yue: load(KEYS.DEFAULT_YUE_LEVEL, 2),
      fr: 2,
      es: 2,
      en: 2,
    };
    save(DEFAULT_LEVELS_KEY, map);
  }
  // Ensure new languages have defaults
  let updated = false;
  for (const [k, v] of Object.entries(DEFAULT_LEVELS_DEFAULTS)) {
    if (map[k] === undefined) { map[k] = v; updated = true; }
  }
  if (updated) save(DEFAULT_LEVELS_KEY, map);
  return map;
}

export function saveDefaultLevels(map) {
  save(DEFAULT_LEVELS_KEY, map);
}

// ── Dark mode preference ──────────────────────────────────────

export function loadDarkMode() {
  const stored = load(KEYS.DARK_MODE, null);
  if (stored !== null) return stored;
  // Auto-detect OS preference on first load
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function saveDarkMode(val) {
  save(KEYS.DARK_MODE, val);
}

// ── TTS voice preference ──────────────────────────────────────

export function loadTtsVoiceURI() {
  return load(KEYS.TTS_VOICE_URI, null);
}

export function saveTtsVoiceURI(uri) {
  save(KEYS.TTS_VOICE_URI, uri);
}

// ── Korean TTS voice preference ──────────────────────────────

export function loadTtsKoVoiceURI() {
  return load(KEYS.TTS_KO_VOICE_URI, null);
}

export function saveTtsKoVoiceURI(uri) {
  save(KEYS.TTS_KO_VOICE_URI, uri);
}

// ── Cantonese TTS voice preference ────────────────────────────

export function loadTtsYueVoiceURI() {
  return load(KEYS.TTS_YUE_VOICE_URI, null);
}

export function saveTtsYueVoiceURI(uri) {
  save(KEYS.TTS_YUE_VOICE_URI, uri);
}

// ── TTS voice URIs map (per-language) ─────────────────────────

const TTS_VOICE_URIS_DEFAULTS = { zh: null, ko: null, yue: null, fr: null, es: null, en: null };

export function loadTtsVoiceURIs() {
  let map = load(KEYS.TTS_VOICE_URIS, null);
  if (!map) {
    // Migrate from legacy per-language keys
    map = {
      zh:  load(KEYS.TTS_VOICE_URI, null),
      ko:  load(KEYS.TTS_KO_VOICE_URI, null),
      yue: load(KEYS.TTS_YUE_VOICE_URI, null),
      fr: null, es: null, en: null,
    };
    save(KEYS.TTS_VOICE_URIS, map);
  }
  // Ensure new languages have defaults
  let updated = false;
  for (const [k, v] of Object.entries(TTS_VOICE_URIS_DEFAULTS)) {
    if (map[k] === undefined) { map[k] = v; updated = true; }
  }
  if (updated) save(KEYS.TTS_VOICE_URIS, map);
  return map;
}

export function saveTtsVoiceURIs(map) {
  save(KEYS.TTS_VOICE_URIS, map);
  // Write-through to legacy keys for backward compat
  if (map.zh !== undefined) save(KEYS.TTS_VOICE_URI, map.zh);
  if (map.ko !== undefined) save(KEYS.TTS_KO_VOICE_URI, map.ko);
  if (map.yue !== undefined) save(KEYS.TTS_YUE_VOICE_URI, map.yue);
}

// ── TTS speech rate preference ────────────────────────────────

export function loadTtsSpeechRate() {
  return load(KEYS.TTS_SPEECH_RATE, 1);
}

export function saveTtsSpeechRate(rate) {
  save(KEYS.TTS_SPEECH_RATE, rate);
}

// ── Romanization toggle preference ───────────────────────────

export function loadRomanizationOn() {
  return load(KEYS.ROMANIZATION_ON, false);
}

export function saveRomanizationOn(val) {
  save(KEYS.ROMANIZATION_ON, val);
}

// ── Translate buttons preference ─────────────────────────────

export function loadTranslateButtons() {
  return load(KEYS.TRANSLATE_BUTTONS, true);
}

export function saveTranslateButtons(val) {
  save(KEYS.TRANSLATE_BUTTONS, val);
}

// ── Translate questions preference ──────────────────────────

export function loadTranslateQuestions() {
  return load(KEYS.TRANSLATE_QUESTIONS, false);
}

export function saveTranslateQuestions(val) {
  save(KEYS.TRANSLATE_QUESTIONS, val);
}

// ── Export sentence options (per-language) ────────────────────

const DEFAULT_EXPORT_FLAGS = { zh: false, ko: false, yue: false, fr: false, es: false, en: false };

function migrateVerboseVocab() {
  const old = load(KEYS.VERBOSE_VOCAB, null);
  if (old === null) return;
  // Migrate old verboseVocab (boolean or per-lang object) → both new keys
  let flags;
  if (typeof old === 'boolean') {
    flags = { zh: old, ko: old, yue: old };
  } else if (old && typeof old === 'object') {
    flags = { zh: Boolean(old.zh), ko: Boolean(old.ko), yue: Boolean(old.yue) };
  } else {
    flags = { ...DEFAULT_EXPORT_FLAGS };
  }
  save(KEYS.EXPORT_SENTENCE_ROM, flags);
  save(KEYS.EXPORT_SENTENCE_TRANS, flags);
  localStorage.removeItem(KEYS.VERBOSE_VOCAB);
}

export function loadExportSentenceRom() {
  migrateVerboseVocab();
  const stored = load(KEYS.EXPORT_SENTENCE_ROM, null);
  if (stored && typeof stored === 'object') {
    const result = { ...DEFAULT_EXPORT_FLAGS };
    for (const k of Object.keys(result)) result[k] = Boolean(stored[k]);
    return result;
  }
  return { ...DEFAULT_EXPORT_FLAGS };
}

export function saveExportSentenceRom(val) {
  save(KEYS.EXPORT_SENTENCE_ROM, val);
}

export function loadExportSentenceTrans() {
  migrateVerboseVocab();
  const stored = load(KEYS.EXPORT_SENTENCE_TRANS, null);
  if (stored && typeof stored === 'object') {
    const result = { ...DEFAULT_EXPORT_FLAGS };
    for (const k of Object.keys(result)) result[k] = Boolean(stored[k]);
    return result;
  }
  return { ...DEFAULT_EXPORT_FLAGS };
}

export function saveExportSentenceTrans(val) {
  save(KEYS.EXPORT_SENTENCE_TRANS, val);
}

export function loadStructuredOutput() {
  return load(KEYS.STRUCTURED_OUTPUT, false);
}

export function saveStructuredOutput(val) {
  save(KEYS.STRUCTURED_OUTPUT, val);
}

// ── Cloud last-synced timestamp ───────────────────────────────

export function loadCloudLastSynced() {
  return load(KEYS.CLOUD_LAST_SYNCED, null);
}

export function saveCloudLastSynced(ts) {
  save(KEYS.CLOUD_LAST_SYNCED, ts);
}

// ── Last-modified timestamp ───────────────────────────────────

export function loadLastModified() {
  return load('gradedReader_lastModified', null);
}

export function saveLastModified(ts) {
  save('gradedReader_lastModified', ts);
}

// ── Last session (restore on reload) ─────────────────────────

const SESSION_KEY = 'gradedReader_lastSession';

export function loadLastSession() {
  return load(SESSION_KEY, null);
}

export function saveLastSession(session) {
  // session: { syllabusId, syllabusView, standaloneKey }
  save(SESSION_KEY, session);
}

// ── Learning Activity ─────────────────────────────────────────

export function loadLearningActivity() {
  return load(KEYS.LEARNING_ACTIVITY, []);
}

export function saveLearningActivity(activity) {
  save(KEYS.LEARNING_ACTIVITY, activity);
}

const ACTIVITY_STASH_KEY = 'gradedReader_learningActivity_stash';
const STASH_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const STASH_THRESHOLD = 500;

/**
 * Move activity entries older than 90 days to a separate stash key.
 * Called when the main array exceeds STASH_THRESHOLD entries.
 * Returns the pruned (recent) activity array.
 */
export function stashOldActivity(activity) {
  if (activity.length <= STASH_THRESHOLD) return activity;
  const cutoff = Date.now() - STASH_AGE_MS;
  const recent = [];
  const old = [];
  for (const entry of activity) {
    if ((entry.timestamp || 0) < cutoff) old.push(entry);
    else recent.push(entry);
  }
  if (old.length === 0) return activity;
  // Merge with existing stash
  const existingStash = load(ACTIVITY_STASH_KEY, []);
  save(ACTIVITY_STASH_KEY, [...existingStash, ...old]);
  save(KEYS.LEARNING_ACTIVITY, recent);
  return recent;
}

export function loadActivityStash() {
  return load(ACTIVITY_STASH_KEY, []);
}

// ── New cards per day preference ──────────────────────────────

export function loadNewCardsPerDay() {
  return load(KEYS.NEW_CARDS_PER_DAY, 20);
}

export function saveNewCardsPerDay(n) {
  save(KEYS.NEW_CARDS_PER_DAY, n);
}

// ── Flashcard session (ephemeral, no file fanout) ────────────

export function loadFlashcardSession(langId) {
  if (langId) return load(`${KEYS.FLASHCARD_SESSION}_${langId}`, null);
  return load(KEYS.FLASHCARD_SESSION, null);
}

export function saveFlashcardSession(session, langId) {
  if (langId) save(`${KEYS.FLASHCARD_SESSION}_${langId}`, session);
  else save(KEYS.FLASHCARD_SESSION, session);
}

// ── Reading time tracking ─────────────────────────────────────

export function loadReadingTime() {
  return load(KEYS.READING_TIME, {});
}

export function saveReadingTime(data) {
  save(KEYS.READING_TIME, data);
}

// ── Native language preference ─────────────────────────────────

export function loadNativeLang() {
  return load(KEYS.NATIVE_LANG, 'en');
}

export function saveNativeLang(langId) {
  save(KEYS.NATIVE_LANG, langId);
}

// ── Reading time log (timestamped sessions) ──────────────────────

export function loadReadingTimeLog() {
  return load(KEYS.READING_TIME_LOG, []);
}

export function saveReadingTimeLog(log) {
  save(KEYS.READING_TIME_LOG, log);
}

// ── Weekly goals ─────────────────────────────────────────

const DEFAULT_WEEKLY_GOALS = { lessons: 3, flashcards: 30, quizzes: 2, minutes: 30 };

export function loadWeeklyGoals() {
  return load(KEYS.WEEKLY_GOALS, DEFAULT_WEEKLY_GOALS);
}

export function saveWeeklyGoals(goals) {
  save(KEYS.WEEKLY_GOALS, goals);
}

// ── Storage usage estimate ────────────────────────────────────

export function getStorageUsage() {
  try {
    let bytes = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        bytes += (localStorage.getItem(key) || '').length * 2;
      }
    }
    const limit = 5 * 1024 * 1024;
    return { used: bytes, limit, pct: Math.round((bytes / limit) * 100) };
  } catch {
    return { used: 0, limit: 5 * 1024 * 1024, pct: 0 };
  }
}

// ── Clear everything ──────────────────────────────────────────

export function clearAllAppData() {
  // Clear per-reader keys
  const index = load(KEYS.READER_INDEX, []);
  for (const key of index) {
    localStorage.removeItem(READER_KEY_PREFIX + key);
  }
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(KEYS.READERS); // legacy monolithic key
  // Clear evicted reader keys
  localStorage.removeItem(KEYS.EVICTED_READER_KEYS);
  // Clear dismissible tips
  localStorage.removeItem('gradedReader_nativeLangTipDismissed');
  // Files are left on disk intentionally — user can delete the folder manually
}

// ── Backup export ─────────────────────────────────────────────

/**
 * Returns a snapshot of all app data suitable for JSON export.
 * Reads directly from localStorage so it captures ALL readers,
 * not just the ones currently in React state.
 * API key is deliberately excluded.
 */
export function exportAllData() {
  return {
    version:          1,
    exportedAt:       new Date().toISOString(),
    syllabi:          load(KEYS.SYLLABI, []),
    syllabusProgress: load(KEYS.SYLLABUS_PROGRESS, {}),
    standaloneReaders:load(KEYS.STANDALONE_READERS, []),
    generatedReaders: loadAllReaders(),
    learnedVocabulary:load(KEYS.VOCABULARY, {}),
    exportedWords:    load(KEYS.EXPORTED, []),
  };
}
