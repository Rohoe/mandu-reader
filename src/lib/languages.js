/**
 * Language configuration registry.
 * Each language is a static config object defining proficiency levels,
 * script detection, typography, TTS, prompt fragments, and UI strings.
 */

const zhConfig = {
  id: 'zh',
  name: 'Mandarin Chinese',
  nameNative: '中文',
  deckLabel: 'Chinese',
  scriptType: 'cjk',

  // Proficiency system
  proficiency: {
    name: 'HSK',
    levels: [
      { value: 0, label: 'HSK 0', desc: 'Total beginner (~30 words, pinyin focus)', wordThreshold: 30 },
      { value: 1, label: 'HSK 1', desc: 'Absolute beginner (~150 words)', wordThreshold: 150 },
      { value: 2, label: 'HSK 2', desc: 'Elementary (~300 words)', wordThreshold: 300 },
      { value: 3, label: 'HSK 3', desc: 'Pre-intermediate (~600 words)', wordThreshold: 600 },
      { value: 4, label: 'HSK 4', desc: 'Intermediate (~1,200 words)', wordThreshold: 1200 },
      { value: 5, label: 'HSK 5', desc: 'Upper-intermediate (~2,500 words)', wordThreshold: 2500 },
      { value: 6, label: 'HSK 6', desc: 'Advanced (~5,000 words)', wordThreshold: 5000 },
    ],
  },

  // Data field mapping (what Claude returns)
  fields: { target: 'chinese', romanization: 'pinyin', translation: 'english' },

  // Character detection
  scriptRegex: /[\u4e00-\u9fff]/,
  punctuation: '\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011',
  charUnit: 'Chinese characters (字)',
  charUnitShort: '字',
  sentenceEndRegex: /([。！？；])/,

  // Typography
  fonts: {
    target: "'Noto Serif SC', 'Songti SC', 'SimSun', 'STSong', Georgia, serif",
    googleImport: 'Noto+Serif+SC:wght@400;600;700',
  },
  lineHeight: 1.9,

  // TTS
  tts: {
    langFilter: /zh/i,
    defaultLang: 'zh-CN',
    defaultRate: 0.85,
    priorityVoices: [
      v => v.name === 'Google 普通话（中国大陆）',
      v => v.name === 'Google 国语（台灣）',
      v => /^Tingting$/i.test(v.name),
      v => /^Meijia$/i.test(v.name),
      v => v.lang === 'zh-CN',
      v => v.lang.startsWith('zh'),
    ],
  },

  // Romanization (lazy-loaded)
  getRomanizer: () => import('pinyin-pro').then(m => ({
    romanize: (text) => m.pinyin(text, { type: 'array', toneType: 'symbol' }),
  })),

  // UI
  placeholders: {
    syllabus: 'e.g. Chinese business culture, Traditional festivals…',
    standalone: 'e.g. A day at a Beijing market…',
  },
  decorativeChars: ['读', '写', '学', '文', '语', '书'],
  romanizationLabel: '拼',
  romanizationName: 'pinyin',

  // Prompt fragments
  prompts: {
    curriculumDesigner: 'Mandarin Chinese curriculum designer',
    targetLanguage: 'Mandarin Chinese',
    titleInstruction: 'Chinese lesson title (8-15 characters)',
    titleFieldKey: 'title_zh',
    getStoryRequirements: (level) => {
      const suffix = `- Dialogue and discourse markers should reflect natural speech patterns appropriate to the context
- Avoid vocabulary or structures above the target HSK level unless explicitly introduced as new words`;
      const bands = {
        0: `- HSK 0: Absolute total beginner — ultra-short sentences (3-5 characters each), only the ~30 most common words (我、你、他、好、是、有、不、大、小、来、去、吃、喝、家、人), no grammar beyond subject+verb+object, every character introduced in vocabulary, heavy pinyin support expected`,
        1: `- HSK 1-2: Simple sentences (5-10 characters), basic 是/有/在 structures, high-frequency verbs, concrete nouns, present/past with 了`,
        2: `- HSK 1-2: Simple sentences (5-10 characters), basic 是/有/在 structures, high-frequency verbs, concrete nouns, present/past with 了`,
        3: `- HSK 3-4: Compound sentences, 把/被 constructions, common complements (得、到、完), conjunctions (虽然...但是, 因为...所以), some idiomatic expressions`,
        4: `- HSK 3-4: Compound sentences, 把/被 constructions, common complements (得、到、完), conjunctions (虽然...但是, 因为...所以), some idiomatic expressions`,
        5: `- HSK 5-6: Complex syntax, literary expressions where appropriate (之、而、则), abstract vocabulary, formal and informal register as suits the content, classical allusions or chengyu if relevant to the topic`,
        6: `- HSK 5-6: Complex syntax, literary expressions where appropriate (之、而、则), abstract vocabulary, formal and informal register as suits the content, classical allusions or chengyu if relevant to the topic`,
      };
      return `- Calibrate language complexity to HSK ${level}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "chinese": "词", "pinyin": "cí", "english": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'Mandarin grammar patterns',
    gradingContext: 'Chinese language teacher',
    gradingLanguage: 'Mandarin',
  },
};

const koConfig = {
  id: 'ko',
  name: 'Korean',
  nameNative: '한국어',
  deckLabel: 'Korean',
  scriptType: 'syllabic',

  proficiency: {
    name: 'TOPIK',
    levels: [
      { value: 0, label: 'TOPIK 0', desc: 'Total beginner (~30 words, hangul focus)', wordThreshold: 30 },
      { value: 1, label: 'TOPIK 1', desc: 'Absolute beginner (~800 words)', wordThreshold: 800 },
      { value: 2, label: 'TOPIK 2', desc: 'Elementary (~1,500 words)', wordThreshold: 1500 },
      { value: 3, label: 'TOPIK 3', desc: 'Pre-intermediate (~3,000 words)', wordThreshold: 3000 },
      { value: 4, label: 'TOPIK 4', desc: 'Intermediate (~5,000 words)', wordThreshold: 5000 },
      { value: 5, label: 'TOPIK 5', desc: 'Upper-intermediate (~8,000 words)', wordThreshold: 8000 },
      { value: 6, label: 'TOPIK 6', desc: 'Advanced (~12,000 words)', wordThreshold: 12000 },
    ],
  },

  fields: { target: 'korean', romanization: 'romanization', translation: 'english' },

  scriptRegex: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  punctuation: '\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011',
  charUnit: 'Korean syllables',
  charUnitShort: '자',
  sentenceEndRegex: /([。.！!？?])/,

  fonts: {
    target: "'Noto Serif KR', 'Batang', 'Gungsuh', Georgia, serif",
    googleImport: 'Noto+Serif+KR:wght@400;600;700',
  },
  lineHeight: 1.8,

  tts: {
    langFilter: /ko/i,
    defaultLang: 'ko-KR',
    defaultRate: 0.9,
    priorityVoices: [
      v => v.name === 'Google 한국의',
      v => /^Yuna$/i.test(v.name),
      v => v.lang === 'ko-KR',
      v => v.lang.startsWith('ko'),
    ],
  },

  getRomanizer: () => import('hangul-romanization').then(m => ({
    romanize: (text) => {
      const fn = m.convert || m.romanize || m.default?.romanize || m.default;
      if (typeof fn === 'function') {
        // Return array of romanizations per character for ruby display
        const result = [];
        for (const char of text) {
          if (/[\uAC00-\uD7AF]/.test(char)) {
            result.push(fn(char));
          } else {
            result.push(char);
          }
        }
        return result;
      }
      return [...text];
    },
  })),

  placeholders: {
    syllabus: 'e.g. Korean food culture, K-drama themes…',
    standalone: 'e.g. A trip to a Seoul café…',
  },
  decorativeChars: ['읽', '쓰', '배', '글', '어', '책'],
  romanizationLabel: 'Aa',
  romanizationName: 'romanization',

  prompts: {
    curriculumDesigner: 'Korean language curriculum designer',
    targetLanguage: 'Korean',
    titleInstruction: 'Korean lesson title (5-15 syllables)',
    titleFieldKey: 'title_ko',
    getStoryRequirements: (level) => {
      const suffix = `- Dialogue should use appropriate speech levels (존댓말/반말) for the context
- Avoid vocabulary or structures above the target TOPIK level unless explicitly introduced as new words`;
      const bands = {
        0: `- TOPIK 0: Absolute total beginner — ultra-short sentences (3-6 syllables each), only the ~30 most common words (나, 너, 이, 그, 있다, 없다, 좋다, 가다, 오다, 먹다, 물, 집, 사람, 크다, 작다), no grammar beyond subject+verb, every word introduced in vocabulary, heavy romanization support expected`,
        1: `- TOPIK 1-2: Simple sentences, basic 이다/있다/없다 structures, high-frequency verbs, concrete nouns, present/past with -았/었-, polite speech level (-아요/-어요)`,
        2: `- TOPIK 1-2: Simple sentences, basic 이다/있다/없다 structures, high-frequency verbs, concrete nouns, present/past with -았/었-, polite speech level (-아요/-어요)`,
        3: `- TOPIK 3-4: Compound sentences, passive/causative constructions, common grammar patterns (-는 것, -기 때문에, -으면), connecting endings (-고, -지만, -아서), some idiomatic expressions`,
        4: `- TOPIK 3-4: Compound sentences, passive/causative constructions, common grammar patterns (-는 것, -기 때문에, -으면), connecting endings (-고, -지만, -아서), some idiomatic expressions`,
        5: `- TOPIK 5-6: Complex syntax, formal register (-습니다), literary expressions, advanced grammar (-는 바, -에 의하면), hanja-derived vocabulary, proverbs if relevant`,
        6: `- TOPIK 5-6: Complex syntax, formal register (-습니다), literary expressions, advanced grammar (-는 바, -에 의하면), hanja-derived vocabulary, proverbs if relevant`,
      };
      return `- Calibrate language complexity to TOPIK ${level}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "korean": "단어", "romanization": "dan-eo", "english": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'Korean grammar patterns',
    gradingContext: 'Korean language teacher',
    gradingLanguage: 'Korean',
  },
};

const yueConfig = {
  id: 'yue',
  name: 'Cantonese',
  nameNative: '粵語',
  deckLabel: 'Cantonese',
  scriptType: 'cjk',

  proficiency: {
    name: 'YUE',
    levels: [
      { value: 0, label: 'YUE 0', desc: 'Total beginner (~30 words, jyutping focus)', wordThreshold: 30 },
      { value: 1, label: 'YUE 1', desc: 'Absolute beginner (~150 words)', wordThreshold: 150 },
      { value: 2, label: 'YUE 2', desc: 'Elementary (~300 words)', wordThreshold: 300 },
      { value: 3, label: 'YUE 3', desc: 'Pre-intermediate (~600 words)', wordThreshold: 600 },
      { value: 4, label: 'YUE 4', desc: 'Intermediate (~1,200 words)', wordThreshold: 1200 },
      { value: 5, label: 'YUE 5', desc: 'Upper-intermediate (~2,500 words)', wordThreshold: 2500 },
      { value: 6, label: 'YUE 6', desc: 'Advanced (~5,000 words)', wordThreshold: 5000 },
    ],
  },

  fields: { target: 'chinese', romanization: 'jyutping', translation: 'english' },

  scriptRegex: /[\u4e00-\u9fff]/,
  punctuation: '\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011',
  charUnit: 'Chinese characters (字)',
  charUnitShort: '字',
  sentenceEndRegex: /([。！？；])/,

  fonts: {
    target: "'Noto Serif TC', 'Noto Serif SC', 'PMingLiU', Georgia, serif",
    googleImport: 'Noto+Serif+TC:wght@400;600;700',
  },
  lineHeight: 1.9,

  tts: {
    langFilter: /zh-HK|yue/i,
    defaultLang: 'zh-HK',
    defaultRate: 0.85,
    priorityVoices: [
      v => /^Sin-?ji$/i.test(v.name),
      v => v.name === 'Google 粵語（香港）',
      v => v.lang === 'zh-HK',
      v => /yue/i.test(v.lang),
      v => v.lang.startsWith('zh'),
    ],
  },

  getRomanizer: () => import('to-jyutping').then(m => {
    const toJyutping = m.default || m;
    return {
      romanize: (text) => {
        const result = [];
        const pairs = toJyutping.getJyutpingList(text);
        for (const [char, jyutping] of pairs) {
          result.push(jyutping || char);
        }
        return result;
      },
    };
  }),

  placeholders: {
    syllabus: 'e.g. Hong Kong street food, Cantonese opera…',
    standalone: 'e.g. A morning at a cha chaan teng…',
  },
  decorativeChars: ['廣', '粵', '話', '語', '字', '音'],
  romanizationLabel: '粵',
  romanizationName: 'jyutping',

  prompts: {
    curriculumDesigner: 'Cantonese Chinese curriculum designer',
    targetLanguage: 'Cantonese Chinese (written Cantonese)',
    titleInstruction: 'Cantonese lesson title in traditional Chinese characters (8-15 characters)',
    titleFieldKey: 'title_yue',
    getStoryRequirements: (level) => {
      const cantoPrefix = `- Write in WRITTEN CANTONESE (書面粵語), NOT standard written Chinese (書面語):
  - Use Cantonese-specific grammar: 係 (not 是), 唔 (not 不), 佢 (not 他/她), 喺 (not 在), 嘅 (not 的), 畀 (not 給), 咗 (not 了 for completion), 緊 (for progressive), 嚟 (not 來), 噉 (not 這樣), 點解 (not 為什麼)
  - Use traditional Chinese characters throughout
  - Include Cantonese sentence-final particles where natural: 啦, 喎, 嘅, 咩, 㗎, 囉, 喇, 呢
  - Dialogue should reflect natural Cantonese speech patterns`;
      const suffix = `- Avoid vocabulary or structures above the target level unless explicitly introduced as new words`;
      const bands = {
        0: `- Level 0: Absolute total beginner — ultra-short sentences (3-5 characters each), only the ~30 most common Cantonese words (我、你、佢、好、係、有、唔、大、細、嚟、去、食、飲、屋、人), no grammar beyond subject+verb+object, every character introduced in vocabulary, heavy jyutping support expected`,
        1: `- Level 1-2: Simple sentences (5-10 characters), basic 係/有/喺 structures, high-frequency Cantonese verbs, concrete nouns, past tense with 咗`,
        2: `- Level 1-2: Simple sentences (5-10 characters), basic 係/有/喺 structures, high-frequency Cantonese verbs, concrete nouns, past tense with 咗`,
        3: `- Level 3-4: Compound sentences, 將/被 constructions, common Cantonese complements (到、晒、返), conjunctions (雖然...但係, 因為...所以), Cantonese idioms`,
        4: `- Level 3-4: Compound sentences, 將/被 constructions, common Cantonese complements (到、晒、返), conjunctions (雖然...但係, 因為...所以), Cantonese idioms`,
        5: `- Level 5-6: Complex syntax, literary Cantonese expressions, abstract vocabulary, mixing formal and colloquial registers, Cantonese proverbs and slang`,
        6: `- Level 5-6: Complex syntax, literary Cantonese expressions, abstract vocabulary, mixing formal and colloquial registers, Cantonese proverbs and slang`,
      };
      return `${cantoPrefix}\n- Calibrate language complexity to YUE ${level}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "chinese": "詞", "jyutping": "ci4", "english": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'Cantonese grammar patterns',
    gradingContext: 'Cantonese language teacher',
    gradingLanguage: 'Cantonese',
  },
};

const frConfig = {
  id: 'fr',
  name: 'French',
  nameNative: 'Français',
  deckLabel: 'French',
  scriptType: 'latin',

  proficiency: {
    name: 'CEFR',
    levels: [
      { value: 0, label: 'A0', desc: 'Total beginner (~30 words)', wordThreshold: 30 },
      { value: 1, label: 'A1', desc: 'Beginner (~500 words)', wordThreshold: 500 },
      { value: 2, label: 'A2', desc: 'Elementary (~1,000 words)', wordThreshold: 1000 },
      { value: 3, label: 'B1', desc: 'Intermediate (~2,000 words)', wordThreshold: 2000 },
      { value: 4, label: 'B2', desc: 'Upper-intermediate (~4,000 words)', wordThreshold: 4000 },
      { value: 5, label: 'C1', desc: 'Advanced (~8,000 words)', wordThreshold: 8000 },
      { value: 6, label: 'C2', desc: 'Mastery (~16,000 words)', wordThreshold: 16000 },
    ],
  },

  fields: { target: 'french', romanization: null, translation: 'english' },

  scriptRegex: null,
  punctuation: '.,!?;:\u00ab\u00bb\u2018\u2019\u201c\u201d()',
  charUnit: 'words',
  charUnitShort: 'mots',
  sentenceEndRegex: /([.!?])/,

  fonts: {
    target: "'Cormorant Garamond', 'Palatino Linotype', Palatino, Georgia, serif",
    googleImport: null,
  },
  lineHeight: 1.7,

  tts: {
    langFilter: /fr/i,
    defaultLang: 'fr-FR',
    defaultRate: 0.9,
    priorityVoices: [
      v => v.name === 'Google fran\u00e7ais',
      v => /^Thomas$/i.test(v.name),
      v => /^Amelie$/i.test(v.name),
      v => v.lang === 'fr-FR',
      v => v.lang.startsWith('fr'),
    ],
  },

  getRomanizer: null,

  placeholders: {
    syllabus: 'e.g. French cuisine, Parisian daily life\u2026',
    standalone: 'e.g. A morning at a boulangerie\u2026',
  },
  decorativeChars: ['L', 'i', 'r', 'e', '\u00e9', 'F'],
  romanizationLabel: null,
  romanizationName: null,

  prompts: {
    curriculumDesigner: 'French language curriculum designer',
    targetLanguage: 'French',
    titleInstruction: 'French lesson title (3-8 words)',
    titleFieldKey: 'title_fr',
    getStoryRequirements: (level) => {
      const suffix = `- Dialogue should use appropriate register (tu/vous) for the context
- Avoid vocabulary or structures above the target CEFR level unless explicitly introduced as new words`;
      const bands = {
        0: `- A0: Absolute total beginner \u2014 ultra-short sentences (3-6 words each), only the ~30 most common words (je, tu, il, est, a, un, le, la, et, pas, oui, non, bonjour, merci, s'il vous pla\u00eet), no grammar beyond subject+verb, every word introduced in vocabulary`,
        1: `- A1: Simple present-tense sentences (5-8 words), basic \u00eatre/avoir structures, articles (le/la/un/une), common verbs, concrete nouns, simple negation (ne...pas)`,
        2: `- A2: Simple compound sentences, pass\u00e9 compos\u00e9 with avoir/\u00eatre, reflexive verbs, basic prepositions, common adjective agreement, near future (aller + infinitive)`,
        3: `- B1: Complex sentences with subordinate clauses, imparfait vs pass\u00e9 compos\u00e9, conditional, subjunctive after common triggers, relative pronouns (qui, que, o\u00f9), idiomatic expressions`,
        4: `- B2: Nuanced expression, plus-que-parfait, passive voice, advanced subjunctive, concessive clauses (bien que), formal vs informal register shifts, literary vocabulary`,
        5: `- C1-C2: Sophisticated syntax, literary tenses (pass\u00e9 simple, subjonctif imparfait where stylistically apt), abstract vocabulary, cultural references, nuanced argumentation`,
        6: `- C1-C2: Sophisticated syntax, literary tenses (pass\u00e9 simple, subjonctif imparfait where stylistically apt), abstract vocabulary, cultural references, nuanced argumentation`,
      };
      return `- Calibrate language complexity to CEFR ${['A0','A1','A2','B1','B2','C1','C2'][level] || 'B1'}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "french": "mot", "english": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'French grammar patterns',
    gradingContext: 'French language teacher',
    gradingLanguage: 'French',
  },
};

const esConfig = {
  id: 'es',
  name: 'Spanish',
  nameNative: 'Espa\u00f1ol',
  deckLabel: 'Spanish',
  scriptType: 'latin',

  proficiency: {
    name: 'CEFR',
    levels: [
      { value: 0, label: 'A0', desc: 'Total beginner (~30 words)', wordThreshold: 30 },
      { value: 1, label: 'A1', desc: 'Beginner (~500 words)', wordThreshold: 500 },
      { value: 2, label: 'A2', desc: 'Elementary (~1,000 words)', wordThreshold: 1000 },
      { value: 3, label: 'B1', desc: 'Intermediate (~2,000 words)', wordThreshold: 2000 },
      { value: 4, label: 'B2', desc: 'Upper-intermediate (~4,000 words)', wordThreshold: 4000 },
      { value: 5, label: 'C1', desc: 'Advanced (~8,000 words)', wordThreshold: 8000 },
      { value: 6, label: 'C2', desc: 'Mastery (~16,000 words)', wordThreshold: 16000 },
    ],
  },

  fields: { target: 'spanish', romanization: null, translation: 'english' },

  scriptRegex: null,
  punctuation: '.,!?\u00a1\u00bf;:\u00ab\u00bb\u2018\u2019\u201c\u201d()',
  charUnit: 'words',
  charUnitShort: 'palabras',
  sentenceEndRegex: /([.!?])/,

  fonts: {
    target: "'Cormorant Garamond', 'Palatino Linotype', Palatino, Georgia, serif",
    googleImport: null,
  },
  lineHeight: 1.7,

  tts: {
    langFilter: /es/i,
    defaultLang: 'es-ES',
    defaultRate: 0.9,
    priorityVoices: [
      v => v.name === 'Google espa\u00f1ol',
      v => /^Monica$/i.test(v.name),
      v => /^Paulina$/i.test(v.name),
      v => v.lang === 'es-ES',
      v => v.lang.startsWith('es'),
    ],
  },

  getRomanizer: null,

  placeholders: {
    syllabus: 'e.g. Latin American culture, Spanish festivals\u2026',
    standalone: 'e.g. A day at a mercado in Mexico City\u2026',
  },
  decorativeChars: ['L', 'e', 'e', 'r', '\u00f1', 'E'],
  romanizationLabel: null,
  romanizationName: null,

  prompts: {
    curriculumDesigner: 'Spanish language curriculum designer',
    targetLanguage: 'Spanish',
    titleInstruction: 'Spanish lesson title (3-8 words)',
    titleFieldKey: 'title_es',
    getStoryRequirements: (level) => {
      const suffix = `- Dialogue should use appropriate register (t\u00fa/usted) for the context
- Avoid vocabulary or structures above the target CEFR level unless explicitly introduced as new words`;
      const bands = {
        0: `- A0: Absolute total beginner \u2014 ultra-short sentences (3-6 words each), only the ~30 most common words (yo, t\u00fa, \u00e9l, es, hay, un, el, la, y, no, s\u00ed, hola, gracias, por favor), no grammar beyond subject+verb, every word introduced in vocabulary`,
        1: `- A1: Simple present-tense sentences (5-8 words), basic ser/estar/tener structures, articles (el/la/un/una), common verbs, concrete nouns, simple negation`,
        2: `- A2: Simple compound sentences, pret\u00e9rito perfecto/indefinido, reflexive verbs, basic prepositions, adjective agreement, ir a + infinitive`,
        3: `- B1: Complex sentences with subordinate clauses, imperfecto vs indefinido, conditional, subjunctive after common triggers, relative pronouns, idiomatic expressions`,
        4: `- B2: Nuanced expression, pluscuamperfecto, passive voice (ser + past participle), advanced subjunctive, concessive clauses, formal vs informal register shifts`,
        5: `- C1-C2: Sophisticated syntax, literary tenses, abstract vocabulary, cultural references from the Hispanic world, nuanced argumentation, regional variation awareness`,
        6: `- C1-C2: Sophisticated syntax, literary tenses, abstract vocabulary, cultural references from the Hispanic world, nuanced argumentation, regional variation awareness`,
      };
      return `- Calibrate language complexity to CEFR ${['A0','A1','A2','B1','B2','C1','C2'][level] || 'B1'}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "spanish": "palabra", "english": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'Spanish grammar patterns',
    gradingContext: 'Spanish language teacher',
    gradingLanguage: 'Spanish',
  },
};

// ── Registry ─────────────────────────────────────────────────

const enConfig = {
  id: 'en',
  name: 'English',
  nameNative: 'English',
  deckLabel: 'English',
  scriptType: 'latin',

  proficiency: {
    name: 'CEFR',
    levels: [
      { value: 0, label: 'A0', desc: 'Total beginner (~30 words)', wordThreshold: 30 },
      { value: 1, label: 'A1', desc: 'Beginner (~500 words)', wordThreshold: 500 },
      { value: 2, label: 'A2', desc: 'Elementary (~1,000 words)', wordThreshold: 1000 },
      { value: 3, label: 'B1', desc: 'Intermediate (~2,000 words)', wordThreshold: 2000 },
      { value: 4, label: 'B2', desc: 'Upper-intermediate (~4,000 words)', wordThreshold: 4000 },
      { value: 5, label: 'C1', desc: 'Advanced (~8,000 words)', wordThreshold: 8000 },
      { value: 6, label: 'C2', desc: 'Mastery (~16,000 words)', wordThreshold: 16000 },
    ],
  },

  fields: { target: 'english_word', romanization: null, translation: 'translation' },

  scriptRegex: null,
  punctuation: '.,!?;:\u2018\u2019\u201c\u201d()',
  charUnit: 'words',
  charUnitShort: 'words',
  sentenceEndRegex: /([.!?])/,

  fonts: {
    target: "'Cormorant Garamond', 'Palatino Linotype', Palatino, Georgia, serif",
    googleImport: null,
  },
  lineHeight: 1.7,

  tts: {
    langFilter: /en/i,
    defaultLang: 'en-US',
    defaultRate: 0.9,
    priorityVoices: [
      v => v.name === 'Google US English',
      v => /^Samantha$/i.test(v.name),
      v => /^Alex$/i.test(v.name),
      v => v.lang === 'en-US',
      v => v.lang.startsWith('en'),
    ],
  },

  getRomanizer: null,

  placeholders: {
    syllabus: 'e.g. American culture, Business English\u2026',
    standalone: 'e.g. A visit to a farmers market\u2026',
  },
  decorativeChars: ['R', 'e', 'a', 'd', 'E', 'n'],
  romanizationLabel: null,
  romanizationName: null,

  prompts: {
    curriculumDesigner: 'English as a Second Language curriculum designer',
    targetLanguage: 'English',
    titleInstruction: 'English lesson title (3-8 words)',
    titleFieldKey: 'title_en_target',
    getStoryRequirements: (level) => {
      const suffix = `- Dialogue should reflect natural spoken English appropriate to the context
- Avoid vocabulary or structures above the target CEFR level unless explicitly introduced as new words`;
      const bands = {
        0: `- A0: Absolute total beginner \u2014 ultra-short sentences (3-5 words each), only the ~30 most common words (I, you, he, she, is, have, go, come, eat, drink, good, big, small, yes, no), no grammar beyond subject+verb+object, every word introduced in vocabulary`,
        1: `- A1: Simple present-tense sentences (5-8 words), basic be/have/do structures, common verbs, concrete nouns, articles (a/an/the), simple negation, present continuous for actions in progress`,
        2: `- A2: Simple compound sentences, past simple regular/irregular, going to for future, can/could for ability, comparatives/superlatives, prepositions of time and place, basic phrasal verbs`,
        3: `- B1: Complex sentences with relative clauses, present perfect vs past simple, first/second conditionals, modals (must, should, might), passive voice basics, reported speech (simple)`,
        4: `- B2: Nuanced expression, past perfect, third conditional, advanced passive, wish/if only constructions, formal vs informal register, idiomatic expressions, phrasal verbs in context`,
        5: `- C1-C2: Sophisticated syntax, mixed conditionals, inversion for emphasis, cleft sentences, advanced modality, academic/literary vocabulary, nuanced argumentation, register shifting`,
        6: `- C1-C2: Sophisticated syntax, mixed conditionals, inversion for emphasis, cleft sentences, advanced modality, academic/literary vocabulary, nuanced argumentation, register shifting`,
      };
      return `- Calibrate language complexity to CEFR ${['A0','A1','A2','B1','B2','C1','C2'][level] || 'B1'}:\n${bands[level] || bands[3]}\n${suffix}`;
    },
    vocabJsonFields: `{ "english_word": "word", "translation": "n. definition", "example_story": "...", "usage_note_story": "...", "example_extra": "...", "usage_note_extra": "..." }`,
    grammarContext: 'English grammar patterns',
    gradingContext: 'ESL teacher',
    gradingLanguage: 'English',
  },
};

const LANGUAGES = { zh: zhConfig, ko: koConfig, yue: yueConfig, fr: frConfig, es: esConfig, en: enConfig };

export function getLang(id) {
  return LANGUAGES[id] || LANGUAGES.zh;
}

export function getAllLanguages() {
  return Object.values(LANGUAGES);
}

export function getLanguageIds() {
  return Object.keys(LANGUAGES);
}

export const DEFAULT_LANG_ID = 'zh';

/**
 * Whether the learner's level qualifies as "advanced" for target-language immersion.
 * CJK (zh, yue, ko): level >= 5.  CEFR (fr, es, en): level >= 4 (B2).
 */
export function isAdvancedLevel(langId, level) {
  const cfg = getLang(langId);
  if (!cfg) return false;
  const threshold = cfg.scriptType === 'cjk' || cfg.scriptType === 'syllabic' ? 5 : 4;
  return Number(level) >= threshold;
}

/** Get the target-language title from a lesson object, regardless of language. */
export function getLessonTitle(lesson, langId) {
  if (!lesson) return '';
  const key = getLang(langId).prompts.titleFieldKey;
  return lesson[key] || lesson.title_zh || lesson.title_yue || lesson.title_ko || lesson.title_fr || lesson.title_es || lesson.title_en_target || lesson.title_en || lesson.title_target || '';
}
