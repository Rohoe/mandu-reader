// Minimal state objects for reducer tests

export function createMinimalState(overrides = {}) {
  return {
    apiKey: '',
    providerKeys: { anthropic: '', openai: '', gemini: '', openai_compatible: '' },
    activeProvider: 'anthropic',
    activeModels: { anthropic: null, openai: null, gemini: null, openai_compatible: null },
    customBaseUrl: '',
    customModelName: '',
    compatPreset: 'deepseek',
    syllabi: [],
    syllabusProgress: {},
    standaloneReaders: [],
    generatedReaders: {},
    learnedVocabulary: {},
    exportedWords: new Set(),
    loading: false,
    loadingMessage: '',
    error: null,
    notification: null,
    quotaWarning: false,
    fsInitialized: true,
    saveFolder: null,
    fsSupported: false,
    maxTokens: 8192,
    defaultLevel: 3,
    defaultTopikLevel: 2,
    defaultYueLevel: 2,
    darkMode: false,
    ttsVoiceURI: null,
    ttsKoVoiceURI: null,
    ttsYueVoiceURI: null,
    ttsVoiceURIs: { zh: null, ko: null, yue: null, fr: null, es: null, en: null },
    ttsSpeechRate: 1,
    romanizationOn: false,
    translateButtons: true,
    exportSentenceRom: { zh: false, ko: false, yue: false },
    exportSentenceTrans: { zh: false, ko: false, yue: false },
    useStructuredOutput: false,
    evictedReaderKeys: new Set(),
    pendingReaders: {},
    learningActivity: [],
    cloudUser: null,
    cloudSyncing: false,
    cloudLastSynced: null,
    lastModified: 1000000,
    hasMergeSnapshot: false,
    ...overrides,
  };
}

export function createSyllabus(overrides = {}) {
  return {
    id: 'syllabus_test1',
    topic: 'Chinese festivals',
    level: 3,
    langId: 'zh',
    summary: 'A syllabus about Chinese festivals.',
    lessons: [
      { lesson_number: 1, title_zh: '春节', title_en: 'Spring Festival', description: 'About Spring Festival', vocabulary_focus: ['spring', 'festival'] },
      { lesson_number: 2, title_zh: '中秋节', title_en: 'Mid-Autumn Festival', description: 'About Mid-Autumn', vocabulary_focus: ['moon', 'cake'] },
    ],
    createdAt: 1700000000000,
    ...overrides,
  };
}

export function createNarrativeSyllabus(overrides = {}) {
  return {
    id: 'syllabus_narrative_test1',
    topic: 'The Silk Road',
    level: 3,
    langId: 'zh',
    type: 'narrative',
    narrativeType: 'historical',
    sourceMaterial: { title: 'The Silk Road', author: '', period: '200 BCE – 1400 CE', description: '' },
    narrativeArc: {
      overview: 'A journey through the history of the ancient Silk Road trade routes.',
      totalPlannedLessons: 10,
      characters: [
        { name: '张骞', role: 'Han dynasty explorer', introduced_in: 1 },
        { name: '李商人', role: 'Silk merchant', introduced_in: 2 },
      ],
      settings: ['Chang\'an', 'Central Asia', 'Rome'],
    },
    futureArc: {
      summary: 'The later chapters cover the Tang dynasty golden age and eventual decline.',
      segments: [
        { startLesson: 6, endLesson: 8, arcPhase: 'climax', summary: 'Tang dynasty golden age of Silk Road trade' },
        { startLesson: 9, endLesson: 10, arcPhase: 'resolution', summary: 'Decline and legacy of the Silk Road' },
      ],
    },
    summary: 'A journey through the history of the ancient Silk Road trade routes.',
    lessons: [
      { lesson_number: 1, title_zh: '丝绸之路的起源', title_en: 'Origins of the Silk Road', description: 'Zhang Qian\'s mission', vocabulary_focus: ['trade', 'journey'], difficulty_hint: 'review', chapter_summary: 'Zhang Qian sets out from Chang\'an in 138 BCE on a diplomatic mission.', characters: ['张骞'], setting: 'Chang\'an, Han Dynasty', narrative_position: 'setup', continuity_notes: 'Year: 138 BCE. Emperor Wu sends Zhang Qian westward.' },
      { lesson_number: 2, title_zh: '漫长的旅途', title_en: 'The Long Journey', description: 'Capture and escape', vocabulary_focus: ['danger', 'survival'], difficulty_hint: 'core', chapter_summary: 'Zhang Qian is captured by the Xiongnu and held for 10 years.', characters: ['张骞'], setting: 'Xiongnu territory', narrative_position: 'rising', continuity_notes: 'Zhang Qian held captive 10 years. Married a Xiongnu woman.' },
      { lesson_number: 3, title_zh: '逃脱与发现', title_en: 'Escape and Discovery', description: 'Reaching Central Asia', vocabulary_focus: ['freedom', 'trade goods'], difficulty_hint: 'core', chapter_summary: 'Zhang Qian escapes and reaches the kingdoms of Central Asia.', characters: ['张骞', '李商人'], setting: 'Central Asia', narrative_position: 'rising', continuity_notes: 'Zhang Qian reaches Dayuan (Fergana). Discovers grape wine and alfalfa.' },
    ],
    createdAt: 1700000000000,
    ...overrides,
  };
}

export function createStandaloneReader(overrides = {}) {
  return {
    key: 'standalone_test1',
    topic: 'A day at the market',
    level: 2,
    langId: 'zh',
    createdAt: 1700000000000,
    ...overrides,
  };
}

export function createReaderData(overrides = {}) {
  return {
    raw: 'test raw',
    titleZh: '测试',
    titleEn: 'Test',
    story: '这是一个测试故事。',
    vocabulary: [
      { target: '测试', romanization: 'cè shì', translation: 'test', chinese: '测试', pinyin: 'cè shì', english: 'test' },
    ],
    questions: [{ text: '这是什么？', translation: '' }],
    ankiJson: [
      { chinese: '测试', pinyin: 'cè shì', english: 'n. test', example_story: '这是一个测试。', usage_note_story: 'Basic usage.', example_extra: '', usage_note_extra: '' },
    ],
    grammarNotes: [],
    parseError: null,
    langId: 'zh',
    ...overrides,
  };
}
