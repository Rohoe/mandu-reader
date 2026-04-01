import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMinimalState, createSyllabus, createStandaloneReader, createReaderData } from '../test/fixtures/sampleState';

// Mock all storage and external modules before importing
vi.mock('../lib/storage', () => ({
  loadProviderKeys: () => ({ anthropic: '', openai: '', gemini: '', openai_compatible: '' }),
  saveProviderKeys: vi.fn(),
  loadActiveProvider: () => 'anthropic',
  saveActiveProvider: vi.fn(),
  loadActiveModels: () => ({ anthropic: null, openai: null, gemini: null, openai_compatible: null }),
  saveActiveModels: vi.fn(),
  loadCustomBaseUrl: () => '',
  saveCustomBaseUrl: vi.fn(),
  loadCustomModelName: () => '',
  saveCustomModelName: vi.fn(),
  loadCompatPreset: () => 'deepseek',
  saveCompatPreset: vi.fn(),
  loadLearningPaths: () => [],
  saveLearningPaths: vi.fn(),
  loadSyllabi: () => [],
  saveSyllabi: vi.fn(),
  loadSyllabusProgress: () => ({}),
  saveSyllabusProgress: vi.fn(),
  loadStandaloneReaders: () => [],
  saveStandaloneReaders: vi.fn(),
  loadReader: vi.fn(() => null),
  loadReaderIndex: () => [],
  saveReaderSafe: vi.fn(() => ({ ok: true, quotaExceeded: false })),
  deleteReader: vi.fn(),
  clearReaders: vi.fn(),
  saveReader: vi.fn(),
  loadLearnedVocabulary: () => ({}),
  mergeVocabulary: (existing, wordList) => {
    const merged = { ...existing };
    for (const word of wordList) {
      const key = word.target || word.chinese || '';
      if (key && !merged[key]) merged[key] = { pinyin: word.pinyin || '', english: word.english || '', dateAdded: new Date().toISOString() };
    }
    return merged;
  },
  saveLearnedVocabulary: vi.fn(),
  loadLearnedGrammar: () => ({}),
  mergeGrammar: (existing, noteList) => {
    const merged = { ...existing };
    for (const note of noteList) {
      const key = `${note.langId}::${note.pattern}`;
      if (key && !merged[key]) merged[key] = { pattern: note.pattern, langId: note.langId, dateAdded: new Date().toISOString(), interval: 0, ease: 2.5, nextReview: null, reviewCount: 0, lapses: 0 };
    }
    return merged;
  },
  saveLearnedGrammar: vi.fn(),
  loadGrammarSession: vi.fn(() => null),
  saveGrammarSession: vi.fn(),
  loadExportedWords: () => new Set(),
  mergeExportedWords: (existing, newWords) => { const s = new Set(existing); for (const w of newWords) s.add(w); return s; },
  saveExportedWordsFull: vi.fn(),
  clearAllAppData: vi.fn(),
  setDirectoryHandle: vi.fn(),
  getDirectoryHandle: vi.fn(),
  loadMaxTokens: () => 8192,
  saveMaxTokens: vi.fn(),
  loadDefaultLevel: () => 3,
  saveDefaultLevel: vi.fn(),
  loadDefaultTopikLevel: () => 2,
  saveDefaultTopikLevel: vi.fn(),
  loadDefaultYueLevel: () => 2,
  saveDefaultYueLevel: vi.fn(),
  loadDarkMode: () => false,
  saveDarkMode: vi.fn(),
  loadTtsVoiceURI: () => null,
  saveTtsVoiceURI: vi.fn(),
  loadTtsKoVoiceURI: () => null,
  saveTtsKoVoiceURI: vi.fn(),
  loadTtsYueVoiceURI: () => null,
  saveTtsYueVoiceURI: vi.fn(),
  loadTtsVoiceURIs: () => ({ zh: null, ko: null, yue: null, fr: null, es: null, en: null }),
  saveTtsVoiceURIs: vi.fn(),
  loadCloudLastSynced: () => null,
  saveCloudLastSynced: vi.fn(),
  loadTtsSpeechRate: () => 1,
  saveTtsSpeechRate: vi.fn(),
  loadRomanizationOn: () => false,
  saveRomanizationOn: vi.fn(),
  loadTranslateButtons: () => true,
  saveTranslateButtons: vi.fn(),
  loadTranslateQuestions: () => false,
  saveTranslateQuestions: vi.fn(),
  loadExportSentenceRom: () => ({ zh: false, ko: false, yue: false }),
  saveExportSentenceRom: vi.fn(),
  loadExportSentenceTrans: () => ({ zh: false, ko: false, yue: false }),
  saveExportSentenceTrans: vi.fn(),
  loadStructuredOutput: () => false,
  saveStructuredOutput: vi.fn(),
  loadLastModified: () => null,
  saveLastModified: vi.fn(),
  loadLearningActivity: () => [],
  saveLearningActivity: vi.fn(),
  stashOldActivity: vi.fn(a => a),
  evictStaleReaders: vi.fn(() => []),
  loadEvictedReaderKeys: () => new Set(),
  saveEvictedReaderKeys: vi.fn(),
  unmarkEvicted: vi.fn(),
  loadNewCardsPerDay: () => 10,
  saveNewCardsPerDay: vi.fn(),
  loadReadingTime: () => ({}),
  saveReadingTime: vi.fn(),
  loadReadingTimeLog: () => [],
  saveReadingTimeLog: vi.fn(),
  loadWeeklyGoals: () => ({ lessons: 3, flashcards: 30, quizzes: 2, minutes: 30 }),
  saveWeeklyGoals: vi.fn(),
  loadGradingModels: () => ({ anthropic: null, openai: null, gemini: null, openai_compatible: null }),
  saveGradingModels: vi.fn(),
  loadDefaultLevels: () => ({ zh: 3, ko: 2, yue: 2, fr: 2, es: 2, en: 2 }),
  saveDefaultLevels: vi.fn(),
  loadNativeLang: () => 'en',
  saveNativeLang: vi.fn(),
  loadShowArchived: () => false,
  saveShowArchived: vi.fn(),
}));

vi.mock('../lib/fileStorage', () => ({
  loadDirectoryHandle: vi.fn(),
  saveDirectoryHandle: vi.fn(),
  clearDirectoryHandle: vi.fn(),
  verifyPermission: vi.fn(),
  readAllFromFolder: vi.fn(),
  readReaderFromFile: vi.fn(),
  pickDirectory: vi.fn(),
  isSupported: () => false,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('../lib/cloudSync', () => ({
  signOut: vi.fn(),
  pushToCloud: vi.fn(),
  pullFromCloud: vi.fn(),
  pushReaderToCloud: vi.fn(),
  detectConflict: vi.fn(),
  fetchCloudReaderKeys: vi.fn(),
  pullReaderFromCloud: vi.fn(),
  mergeData: vi.fn(),
  pushMergedToCloud: vi.fn(),
}));

vi.mock('../lib/demoReader', () => ({
  DEMO_READER_KEY: 'standalone_demo',
  DEMO_READER_EN_KEY: 'standalone_demo_en',
  DEMO_READER_DATA: { topic: 'Demo', story: 'Demo story', titleZh: '示范', titleEn: 'Demo', langId: 'zh', level: 2 },
  DEMO_READER_EN_DATA: { topic: 'English Demo', story: 'English demo story', titleZh: 'A New School', titleEn: '新学校', langId: 'en', level: 2 },
  DEMO_READERS: [
    { key: 'standalone_demo', data: { topic: 'Demo', story: 'Demo story', titleZh: '示范', titleEn: 'Demo', langId: 'zh', level: 2 } },
    { key: 'standalone_demo_en', data: { topic: 'English Demo', story: 'English demo story', titleZh: 'A New School', titleEn: '新学校', langId: 'en', level: 2 } },
  ],
  DEMO_READER_KEYS: new Set(['standalone_demo', 'standalone_demo_en']),
}));

// Now import the test-only exports
const { _baseReducer: baseReducer, _reducer: reducer, _DATA_ACTIONS: DATA_ACTIONS } = await import('./AppContext.jsx');

// ── Reducer tests ─────────────────────────────────────────────

describe('baseReducer', () => {
  // ── Syllabus actions ──────────────────────────────────────

  describe('ADD_SYLLABUS', () => {
    it('prepends new syllabus', () => {
      const state = createMinimalState();
      const syllabus = createSyllabus({ id: 'new_s1' });
      const next = baseReducer(state, { type: 'ADD_SYLLABUS', payload: syllabus });
      expect(next.syllabi[0].id).toBe('new_s1');
    });

    it('creates initial progress for new syllabus', () => {
      const state = createMinimalState();
      const syllabus = createSyllabus({ id: 'new_s1' });
      const next = baseReducer(state, { type: 'ADD_SYLLABUS', payload: syllabus });
      expect(next.syllabusProgress.new_s1).toEqual({ lessonIndex: 0, completedLessons: [] });
    });

    it('removes demo reader on first real generation', () => {
      const state = createMinimalState({
        standaloneReaders: [{ key: 'standalone_demo', isDemo: true }],
        generatedReaders: { standalone_demo: { story: 'demo' } },
      });
      const syllabus = createSyllabus({ id: 'real_s1' });
      const next = baseReducer(state, { type: 'ADD_SYLLABUS', payload: syllabus });
      expect(next.standaloneReaders.find(r => r.isDemo)).toBeUndefined();
      expect(next.generatedReaders.standalone_demo).toBeUndefined();
    });

    it('removes both demo readers on first real generation', () => {
      const state = createMinimalState({
        standaloneReaders: [
          { key: 'standalone_demo', isDemo: true },
          { key: 'standalone_demo_en', isDemo: true },
        ],
        generatedReaders: {
          standalone_demo: { story: 'demo zh' },
          standalone_demo_en: { story: 'demo en' },
        },
      });
      const syllabus = createSyllabus({ id: 'real_s1' });
      const next = baseReducer(state, { type: 'ADD_SYLLABUS', payload: syllabus });
      expect(next.standaloneReaders.find(r => r.isDemo)).toBeUndefined();
      expect(next.generatedReaders.standalone_demo).toBeUndefined();
      expect(next.generatedReaders.standalone_demo_en).toBeUndefined();
    });
  });

  describe('REMOVE_SYLLABUS', () => {
    it('removes syllabus by id', () => {
      const syllabus = createSyllabus({ id: 'to_delete' });
      const state = createMinimalState({ syllabi: [syllabus] });
      const next = baseReducer(state, { type: 'REMOVE_SYLLABUS', payload: 'to_delete' });
      expect(next.syllabi.length).toBe(0);
    });

    it('cascades delete to progress', () => {
      const syllabus = createSyllabus({ id: 'to_delete' });
      const state = createMinimalState({
        syllabi: [syllabus],
        syllabusProgress: { to_delete: { lessonIndex: 0, completedLessons: [0] } },
      });
      const next = baseReducer(state, { type: 'REMOVE_SYLLABUS', payload: 'to_delete' });
      expect(next.syllabusProgress.to_delete).toBeUndefined();
    });

    it('cascades delete to generated readers', () => {
      const syllabus = createSyllabus({ id: 'to_delete' });
      const state = createMinimalState({
        syllabi: [syllabus],
        generatedReaders: { 'lesson_to_delete_0': { story: 'test' }, other_key: { story: 'keep' } },
      });
      const next = baseReducer(state, { type: 'REMOVE_SYLLABUS', payload: 'to_delete' });
      expect(next.generatedReaders['lesson_to_delete_0']).toBeUndefined();
      expect(next.generatedReaders.other_key).toBeDefined();
    });

    it('cleans up evicted keys for the deleted syllabus', () => {
      const syllabus = createSyllabus({ id: 'to_delete' });
      const state = createMinimalState({
        syllabi: [syllabus],
        evictedReaderKeys: new Set(['lesson_to_delete_0', 'lesson_other_1']),
      });
      const next = baseReducer(state, { type: 'REMOVE_SYLLABUS', payload: 'to_delete' });
      expect(next.evictedReaderKeys.has('lesson_to_delete_0')).toBe(false);
      expect(next.evictedReaderKeys.has('lesson_other_1')).toBe(true);
    });
  });

  describe('EXTEND_SYLLABUS_LESSONS', () => {
    it('appends new lessons with correct numbering', () => {
      const syllabus = createSyllabus({ id: 's1' }); // has 2 lessons
      const state = createMinimalState({ syllabi: [syllabus] });
      const newLessons = [
        { lesson_number: 1, title_zh: '新课1', title_en: 'New 1' },
        { lesson_number: 2, title_zh: '新课2', title_en: 'New 2' },
      ];
      const next = baseReducer(state, { type: 'EXTEND_SYLLABUS_LESSONS', payload: { id: 's1', newLessons } });
      const updated = next.syllabi.find(s => s.id === 's1');
      expect(updated.lessons.length).toBe(4);
      // Renumbered starting from 3
      expect(updated.lessons[2].lesson_number).toBe(3);
      expect(updated.lessons[3].lesson_number).toBe(4);
    });

    it('returns unchanged state for unknown syllabus', () => {
      const state = createMinimalState({ syllabi: [createSyllabus({ id: 's1' })] });
      const next = baseReducer(state, { type: 'EXTEND_SYLLABUS_LESSONS', payload: { id: 'nonexistent', newLessons: [] } });
      expect(next).toBe(state);
    });

    it('consumes futureArc segments when consumeSegments is provided', () => {
      const syllabus = {
        ...createSyllabus({ id: 's2' }),
        type: 'narrative',
        futureArc: {
          summary: 'More to come',
          segments: [
            { start_lesson: 3, end_lesson: 5, arc_phase: 'rising', summary: 'Segment 1' },
            { start_lesson: 6, end_lesson: 8, arc_phase: 'climax', summary: 'Segment 2' },
          ],
        },
      };
      const state = createMinimalState({ syllabi: [syllabus] });
      const newLessons = [{ title_en: 'Ch3' }];
      const next = baseReducer(state, { type: 'EXTEND_SYLLABUS_LESSONS', payload: { id: 's2', newLessons, consumeSegments: 1 } });
      const updated = next.syllabi.find(s => s.id === 's2');
      expect(updated.futureArc.segments).toHaveLength(1);
      expect(updated.futureArc.segments[0].summary).toBe('Segment 2');
    });

    it('clears futureArc when all segments consumed', () => {
      const syllabus = {
        ...createSyllabus({ id: 's3' }),
        type: 'narrative',
        futureArc: {
          summary: 'More to come',
          segments: [{ start_lesson: 3, end_lesson: 5, arc_phase: 'rising', summary: 'Only segment' }],
        },
      };
      const state = createMinimalState({ syllabi: [syllabus] });
      const newLessons = [{ title_en: 'Ch3' }];
      const next = baseReducer(state, { type: 'EXTEND_SYLLABUS_LESSONS', payload: { id: 's3', newLessons, consumeSegments: 1 } });
      const updated = next.syllabi.find(s => s.id === 's3');
      expect(updated.futureArc).toBeNull();
    });
  });

  // ── Lesson progress actions ─────────────────────────────────

  describe('MARK_LESSON_COMPLETE', () => {
    it('adds lesson index to completedLessons', () => {
      const state = createMinimalState({
        syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [] } },
      });
      const next = baseReducer(state, { type: 'MARK_LESSON_COMPLETE', payload: { syllabusId: 's1', lessonIndex: 0 } });
      expect(next.syllabusProgress.s1.completedLessons).toContain(0);
    });

    it('is idempotent — does not add duplicate', () => {
      const state = createMinimalState({
        syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [0] } },
      });
      const next = baseReducer(state, { type: 'MARK_LESSON_COMPLETE', payload: { syllabusId: 's1', lessonIndex: 0 } });
      expect(next).toBe(state); // no change
    });

    it('logs lesson_completed activity', () => {
      const state = createMinimalState({
        syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [] } },
      });
      const next = baseReducer(state, { type: 'MARK_LESSON_COMPLETE', payload: { syllabusId: 's1', lessonIndex: 0 } });
      const entry = next.learningActivity.find(a => a.type === 'lesson_completed');
      expect(entry).toBeTruthy();
      expect(entry.syllabusId).toBe('s1');
    });
  });

  describe('UNMARK_LESSON_COMPLETE', () => {
    it('removes lesson index from completedLessons', () => {
      const state = createMinimalState({
        syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [0, 1] } },
      });
      const next = baseReducer(state, { type: 'UNMARK_LESSON_COMPLETE', payload: { syllabusId: 's1', lessonIndex: 0 } });
      expect(next.syllabusProgress.s1.completedLessons).toEqual([1]);
    });
  });

  // ── Reader actions ──────────────────────────────────────────

  describe('SET_READER', () => {
    it('sets reader data', () => {
      const state = createMinimalState();
      const data = createReaderData();
      const next = baseReducer(state, { type: 'SET_READER', payload: { lessonKey: 'lesson_s1_0', data } });
      expect(next.generatedReaders.lesson_s1_0).toBe(data);
    });

    it('logs reader_generated activity for new story', () => {
      const state = createMinimalState();
      const data = createReaderData({ story: 'A new story' });
      const next = baseReducer(state, { type: 'SET_READER', payload: { lessonKey: 'lesson_s1_0', data } });
      const entry = next.learningActivity.find(a => a.type === 'reader_generated');
      expect(entry).toBeTruthy();
    });

    it('logs quiz_graded activity when grading results are new', () => {
      const state = createMinimalState();
      const data = createReaderData({ gradingResults: { overallScore: '8/10' } });
      const next = baseReducer(state, { type: 'SET_READER', payload: { lessonKey: 'lesson_s1_0', data } });
      const entry = next.learningActivity.find(a => a.type === 'quiz_graded');
      expect(entry).toBeTruthy();
    });

    it('does not log quiz_graded if prev already had grading', () => {
      const prevData = createReaderData({ gradingResults: { overallScore: '7/10' } });
      const state = createMinimalState({
        generatedReaders: { lesson_s1_0: prevData },
      });
      const newData = { ...prevData, gradingResults: { overallScore: '8/10' } };
      const next = baseReducer(state, { type: 'SET_READER', payload: { lessonKey: 'lesson_s1_0', data: newData } });
      const quizEntries = next.learningActivity.filter(a => a.type === 'quiz_graded');
      expect(quizEntries.length).toBe(0);
    });

    it('removes from evictedReaderKeys if present', () => {
      const state = createMinimalState({
        evictedReaderKeys: new Set(['lesson_s1_0']),
      });
      const data = createReaderData();
      const next = baseReducer(state, { type: 'SET_READER', payload: { lessonKey: 'lesson_s1_0', data } });
      expect(next.evictedReaderKeys.has('lesson_s1_0')).toBe(false);
    });
  });

  describe('CLEAR_READER', () => {
    it('removes reader by key', () => {
      const state = createMinimalState({
        generatedReaders: { lesson_s1_0: createReaderData() },
      });
      const next = baseReducer(state, { type: 'CLEAR_READER', payload: 'lesson_s1_0' });
      expect(next.generatedReaders.lesson_s1_0).toBeUndefined();
    });
  });

  // ── Standalone reader actions ────────────────────────────────

  describe('ADD_STANDALONE_READER', () => {
    it('prepends new standalone reader', () => {
      const state = createMinimalState();
      const reader = createStandaloneReader({ key: 'new_sr' });
      const next = baseReducer(state, { type: 'ADD_STANDALONE_READER', payload: reader });
      expect(next.standaloneReaders[0].key).toBe('new_sr');
    });

    it('removes demo reader', () => {
      const state = createMinimalState({
        standaloneReaders: [{ key: 'standalone_demo', isDemo: true }],
        generatedReaders: { standalone_demo: { story: 'demo' } },
      });
      const reader = createStandaloneReader({ key: 'real_sr' });
      const next = baseReducer(state, { type: 'ADD_STANDALONE_READER', payload: reader });
      expect(next.standaloneReaders.find(r => r.isDemo)).toBeUndefined();
    });

    it('removes both demo readers when user creates first standalone reader', () => {
      const state = createMinimalState({
        standaloneReaders: [
          { key: 'standalone_demo', isDemo: true },
          { key: 'standalone_demo_en', isDemo: true },
        ],
        generatedReaders: {
          standalone_demo: { story: 'demo zh' },
          standalone_demo_en: { story: 'demo en' },
        },
      });
      const reader = createStandaloneReader({ key: 'real_sr' });
      const next = baseReducer(state, { type: 'ADD_STANDALONE_READER', payload: reader });
      expect(next.standaloneReaders.find(r => r.isDemo)).toBeUndefined();
      expect(next.generatedReaders.standalone_demo).toBeUndefined();
      expect(next.generatedReaders.standalone_demo_en).toBeUndefined();
    });
  });

  describe('REMOVE_STANDALONE_READER', () => {
    it('removes reader and generated data', () => {
      const state = createMinimalState({
        standaloneReaders: [createStandaloneReader({ key: 'sr1' })],
        generatedReaders: { sr1: createReaderData() },
      });
      const next = baseReducer(state, { type: 'REMOVE_STANDALONE_READER', payload: 'sr1' });
      expect(next.standaloneReaders.length).toBe(0);
      expect(next.generatedReaders.sr1).toBeUndefined();
    });
  });

  // ── Vocabulary actions ──────────────────────────────────────

  describe('ADD_VOCABULARY', () => {
    it('merges new vocabulary', () => {
      const state = createMinimalState();
      const words = [{ target: '猫', pinyin: 'māo', english: 'cat' }];
      const next = baseReducer(state, { type: 'ADD_VOCABULARY', payload: words });
      expect(next.learnedVocabulary['猫']).toBeTruthy();
    });

    it('logs vocab_added activity', () => {
      const state = createMinimalState();
      const words = [{ target: '猫', pinyin: 'māo', english: 'cat' }];
      const next = baseReducer(state, { type: 'ADD_VOCABULARY', payload: words });
      const entry = next.learningActivity.find(a => a.type === 'vocab_added');
      expect(entry).toBeTruthy();
      expect(entry.count).toBe(1);
    });
  });

  describe('CLEAR_VOCABULARY', () => {
    it('clears all vocabulary', () => {
      const state = createMinimalState({ learnedVocabulary: { '猫': { pinyin: 'māo' } } });
      const next = baseReducer(state, { type: 'CLEAR_VOCABULARY' });
      expect(next.learnedVocabulary).toEqual({});
    });
  });

  describe('ADD_EXPORTED_WORDS', () => {
    it('merges new exported words', () => {
      const state = createMinimalState({ exportedWords: new Set(['猫']) });
      const next = baseReducer(state, { type: 'ADD_EXPORTED_WORDS', payload: ['狗', '鱼'] });
      expect(next.exportedWords.has('猫')).toBe(true);
      expect(next.exportedWords.has('狗')).toBe(true);
      expect(next.exportedWords.has('鱼')).toBe(true);
    });
  });

  // ── UI state actions ────────────────────────────────────────

  describe('SET_LOADING', () => {
    it('sets loading state', () => {
      const state = createMinimalState();
      const next = baseReducer(state, { type: 'SET_LOADING', payload: { loading: true, message: 'Generating...' } });
      expect(next.loading).toBe(true);
      expect(next.loadingMessage).toBe('Generating...');
    });
  });

  describe('SET_ERROR', () => {
    it('sets error and clears loading', () => {
      const state = createMinimalState({ loading: true, loadingMessage: 'test' });
      const next = baseReducer(state, { type: 'SET_ERROR', payload: 'Something went wrong' });
      expect(next.error).toBe('Something went wrong');
      expect(next.loading).toBe(false);
      expect(next.loadingMessage).toBe('');
    });
  });

  // ── Archive actions ──────────────────────────────────────────

  describe('ARCHIVE_SYLLABUS', () => {
    it('sets archived flag', () => {
      const state = createMinimalState({ syllabi: [createSyllabus({ id: 's1' })] });
      const next = baseReducer(state, { type: 'ARCHIVE_SYLLABUS', payload: 's1' });
      expect(next.syllabi[0].archived).toBe(true);
    });
  });

  describe('UNARCHIVE_SYLLABUS', () => {
    it('clears archived flag', () => {
      const state = createMinimalState({ syllabi: [createSyllabus({ id: 's1', archived: true })] });
      const next = baseReducer(state, { type: 'UNARCHIVE_SYLLABUS', payload: 's1' });
      expect(next.syllabi[0].archived).toBe(false);
    });
  });

  // ── Default case ────────────────────────────────────────────

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = createMinimalState();
      const next = baseReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(next).toBe(state);
    });
  });
});

// ── Wrapper reducer (lastModified bumping) ──────────────────

describe('reducer (lastModified)', () => {
  it('bumps lastModified for DATA_ACTIONS', () => {
    const state = createMinimalState({ lastModified: 1000 });
    const syllabus = createSyllabus({ id: 'new_s1' });
    const next = reducer(state, { type: 'ADD_SYLLABUS', payload: syllabus });
    expect(next.lastModified).toBeGreaterThan(1000);
  });

  it('does not bump lastModified for non-DATA_ACTIONS', () => {
    const state = createMinimalState({ lastModified: 1000 });
    const next = reducer(state, { type: 'SET_LOADING', payload: { loading: true } });
    expect(next.lastModified).toBe(1000);
  });

  it('does not bump lastModified when state is unchanged', () => {
    const state = createMinimalState({
      lastModified: 1000,
      syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [0] } },
    });
    // MARK_LESSON_COMPLETE is a DATA_ACTION but is idempotent if already complete
    const next = reducer(state, { type: 'MARK_LESSON_COMPLETE', payload: { syllabusId: 's1', lessonIndex: 0 } });
    expect(next.lastModified).toBe(1000);
  });
});

describe('DATA_ACTIONS set', () => {
  it('contains expected actions', () => {
    expect(DATA_ACTIONS.has('ADD_SYLLABUS')).toBe(true);
    expect(DATA_ACTIONS.has('REMOVE_SYLLABUS')).toBe(true);
    expect(DATA_ACTIONS.has('SET_READER')).toBe(true);
    expect(DATA_ACTIONS.has('ADD_VOCABULARY')).toBe(true);
    expect(DATA_ACTIONS.has('MARK_LESSON_COMPLETE')).toBe(true);
  });

  it('does not contain UI-only actions', () => {
    expect(DATA_ACTIONS.has('SET_LOADING')).toBe(false);
    expect(DATA_ACTIONS.has('SET_ERROR')).toBe(false);
    expect(DATA_ACTIONS.has('SET_NOTIFICATION')).toBe(false);
    expect(DATA_ACTIONS.has('SET_DARK_MODE')).toBe(false);
  });
});
