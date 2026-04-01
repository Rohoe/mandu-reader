import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeStats, getStreak, getFlashcardStreak, getWordsByPeriod, buildLearnerContext, buildLearnerProfile, buildGradingContext, buildReviewContext, getLevelUpRecommendation, computeDifficultyCalibration } from './stats';

// ── buildLearnerContext ───────────────────────────────────────

describe('buildLearnerContext', () => {
  function makeVocab(words) {
    const vocab = {};
    for (const w of words) {
      vocab[w.word] = { langId: w.langId || 'zh', reviewCount: w.reviewCount ?? 1, interval: w.interval ?? 5, lapses: w.lapses ?? 0, dateAdded: w.dateAdded || new Date().toISOString() };
    }
    return vocab;
  }

  it('returns null for empty vocabulary', () => {
    expect(buildLearnerContext({}, {}, [], 'zh')).toBeNull();
  });

  it('returns null for fewer than 5 reviewed words in target lang', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 1 },
      { word: '狗', reviewCount: 1 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 1 },
    ]);
    expect(buildLearnerContext(vocab, {}, [], 'zh')).toBeNull();
  });

  it('returns context with 5+ reviewed words', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 4 },
      { word: '牛', reviewCount: 2 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).not.toBeNull();
    expect(result).toContain('Vocabulary:');
    expect(result).toContain('5 reviewed');
  });

  it('filters by langId', () => {
    const vocab = makeVocab([
      { word: '猫', langId: 'zh', reviewCount: 2 },
      { word: '狗', langId: 'zh', reviewCount: 3 },
      { word: '鸟', langId: 'zh', reviewCount: 1 },
      { word: '한국', langId: 'ko', reviewCount: 5 },
      { word: '사과', langId: 'ko', reviewCount: 3 },
    ]);
    // Only 3 zh words reviewed — not enough
    expect(buildLearnerContext(vocab, {}, [], 'zh')).toBeNull();
  });

  it('classifies struggling words (lapses >= 2)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 5, lapses: 3 },
      { word: '狗', reviewCount: 3, lapses: 0 },
      { word: '鸟', reviewCount: 2, lapses: 0 },
      { word: '鱼', reviewCount: 4, lapses: 0 },
      { word: '牛', reviewCount: 2, lapses: 0 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).toContain('1 struggling');
    expect(result).toContain('猫');
  });

  it('classifies struggling words (interval <= 1 and reviewCount >= 3)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 4, interval: 1, lapses: 0 },
      { word: '狗', reviewCount: 3, interval: 0, lapses: 1 },
      { word: '鸟', reviewCount: 2, interval: 5 },
      { word: '鱼', reviewCount: 4, interval: 10 },
      { word: '牛', reviewCount: 2, interval: 3 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).toContain('2 struggling');
    expect(result).toContain('猫');
    expect(result).toContain('狗');
  });

  it('classifies mastered words (interval >= 21)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 10, interval: 30 },
      { word: '狗', reviewCount: 8, interval: 25 },
      { word: '鸟', reviewCount: 2, interval: 5 },
      { word: '鱼', reviewCount: 4, interval: 10 },
      { word: '牛', reviewCount: 2, interval: 3 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).toContain('2 mastered');
  });

  it('caps struggling list at 15 and sorts by lapses desc', () => {
    const words = [];
    for (let i = 0; i < 20; i++) {
      words.push({ word: `字${i}`, reviewCount: 5, lapses: i + 1 });
    }
    const vocab = makeVocab(words);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    // Should contain top 15 by lapses desc
    expect(result).toContain('字19');
    expect(result).toContain('字5'); // index 5 has lapses=6, within top 15
    // Count struggling word entries — the list should have at most 15
    const match = result.match(/Struggling words.*?:\s*(.+)/);
    expect(match).not.toBeNull();
    const wordList = match[1].split(', ');
    expect(wordList.length).toBeLessThanOrEqual(15);
  });

  it('includes quiz performance when available', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 4 },
      { word: '牛', reviewCount: 2 },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 3, lessonKey: 'lesson_1', timestamp: Date.now() },
      { type: 'quiz_graded', score: 4, lessonKey: 'lesson_2', timestamp: Date.now() },
    ];
    const result = buildLearnerContext(vocab, {}, activity, 'zh');
    expect(result).toContain('Recent quiz avg: 3.5/5');
  });

  it('skips quiz section when no quizzes', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 4 },
      { word: '牛', reviewCount: 2 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).not.toContain('quiz');
  });

  it('identifies grammar weaknesses from low quiz scores', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 4 },
      { word: '牛', reviewCount: 2 },
    ]);
    const readers = {
      lesson_1: {
        langId: 'zh',
        grammarNotes: [{ pattern: '把 construction' }, { pattern: '了 completion' }],
      },
    };
    const activity = [
      { type: 'quiz_graded', score: 2, lessonKey: 'lesson_1', questionScores: [1, 2], timestamp: Date.now() },
    ];
    const result = buildLearnerContext(vocab, readers, activity, 'zh');
    expect(result).toContain('Weak grammar areas');
    expect(result).toContain('把 construction');
  });

  it('includes accelerating trajectory', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const words = [];
    // 8 recent words (last 14 days)
    for (let i = 0; i < 8; i++) {
      words.push({ word: `新${i}`, reviewCount: 1, dateAdded: new Date(now - i * day).toISOString() });
    }
    // 2 older words (15-28 days ago)
    for (let i = 0; i < 2; i++) {
      words.push({ word: `旧${i}`, reviewCount: 1, dateAdded: new Date(now - (15 + i) * day).toISOString() });
    }
    const vocab = makeVocab(words);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).toContain('accelerating');
  });

  it('includes decelerating trajectory', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const words = [];
    // 2 recent words (last 14 days)
    for (let i = 0; i < 2; i++) {
      words.push({ word: `新${i}`, reviewCount: 1, dateAdded: new Date(now - i * day).toISOString() });
    }
    // 8 older words (15-28 days ago)
    for (let i = 0; i < 8; i++) {
      words.push({ word: `旧${i}`, reviewCount: 1, dateAdded: new Date(now - (15 + i) * day).toISOString() });
    }
    const vocab = makeVocab(words);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).toContain('decelerating');
  });

  it('skips trajectory with fewer than 10 total words', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
      { word: '鱼', reviewCount: 4 },
      { word: '牛', reviewCount: 2 },
    ]);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result).not.toContain('Trajectory');
  });

  it('respects 500-char cap', () => {
    // Create many struggling words with long names
    const words = [];
    for (let i = 0; i < 20; i++) {
      words.push({ word: `很长的词语名称${i}号`, reviewCount: 5, lapses: i + 1 });
    }
    const vocab = makeVocab(words);
    const result = buildLearnerContext(vocab, {}, [], 'zh');
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

// ── buildLearnerProfile ───────────────────────────────────────

describe('buildLearnerProfile', () => {
  function makeVocab(words) {
    const vocab = {};
    for (const w of words) {
      vocab[w.word] = { langId: w.langId || 'zh', reviewCount: w.reviewCount ?? 0, interval: w.interval ?? 0, dateAdded: new Date().toISOString() };
    }
    return vocab;
  }

  it('returns null with fewer than 5 words', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' },
    ]);
    expect(buildLearnerProfile(vocab, {}, [], [], 'zh')).toBeNull();
  });

  it('returns profile with 5+ words', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' }, { word: '牛' },
    ]);
    const result = buildLearnerProfile(vocab, {}, [], [], 'zh');
    expect(result).not.toBeNull();
    expect(result).toContain('Known vocabulary: 5 words');
  });

  it('includes grammar patterns filtered by langId', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' }, { word: '牛' },
    ]);
    const readers = {
      lesson_1: { langId: 'zh', grammarNotes: [{ pattern: '把 construction' }] },
      lesson_2: { langId: 'ko', grammarNotes: [{ pattern: '-는 것' }] },
    };
    const result = buildLearnerProfile(vocab, readers, [], [], 'zh');
    expect(result).toContain('把 construction');
    expect(result).not.toContain('-는 것');
  });

  it('includes topics from syllabi filtered by langId', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' }, { word: '牛' },
    ]);
    const syllabi = [
      { langId: 'zh', topic: 'Business culture' },
      { langId: 'ko', topic: 'K-drama themes' },
    ];
    const result = buildLearnerProfile(vocab, {}, syllabi, [], 'zh');
    expect(result).toContain('Business culture');
    expect(result).not.toContain('K-drama');
  });

  it('includes quiz avg when available', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' }, { word: '牛' },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 4 },
      { type: 'quiz_graded', score: 3 },
    ];
    const result = buildLearnerProfile(vocab, {}, [], activity, 'zh');
    expect(result).toContain('Recent quiz avg: 3.5/5');
  });

  it('omits quiz avg when no quizzes', () => {
    const vocab = makeVocab([
      { word: '猫' }, { word: '狗' }, { word: '鸟' }, { word: '鱼' }, { word: '牛' },
    ]);
    const result = buildLearnerProfile(vocab, {}, [], [], 'zh');
    expect(result).not.toContain('quiz');
  });

  it('respects 400-char cap', () => {
    const words = [];
    for (let i = 0; i < 50; i++) words.push({ word: `很长的词语${i}号` });
    const vocab = makeVocab(words);
    const readers = {};
    for (let i = 0; i < 20; i++) {
      readers[`r${i}`] = { langId: 'zh', grammarNotes: [{ pattern: `Pattern_${i}_with_long_name` }] };
    }
    const result = buildLearnerProfile(vocab, readers, [], [], 'zh');
    expect(result.length).toBeLessThanOrEqual(400);
  });
});

// ── buildGradingContext ───────────────────────────────────────

describe('buildGradingContext', () => {
  function makeVocab(words) {
    const vocab = {};
    for (const w of words) {
      vocab[w.word] = { langId: w.langId || 'zh', reviewCount: w.reviewCount ?? 1, interval: w.interval ?? 5 };
    }
    return vocab;
  }

  it('returns null with fewer than 3 reviewed words', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 1 },
      { word: '狗', reviewCount: 1 },
    ]);
    expect(buildGradingContext(vocab, [], 'zh')).toBeNull();
  });

  it('classifies struggling tone (avg < 2.5)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 }, { word: '狗', reviewCount: 3 }, { word: '鸟', reviewCount: 1 },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 2 }, { type: 'quiz_graded', score: 1 },
    ];
    const result = buildGradingContext(vocab, activity, 'zh');
    expect(result).toContain('struggling');
  });

  it('classifies developing tone (avg 2.5-3.5)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 }, { word: '狗', reviewCount: 3 }, { word: '鸟', reviewCount: 1 },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 3 }, { type: 'quiz_graded', score: 3 },
    ];
    const result = buildGradingContext(vocab, activity, 'zh');
    expect(result).toContain('developing');
  });

  it('classifies proficient tone (avg 3.5-4.5)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 }, { word: '狗', reviewCount: 3 }, { word: '鸟', reviewCount: 1 },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 4 }, { type: 'quiz_graded', score: 4 },
    ];
    const result = buildGradingContext(vocab, activity, 'zh');
    expect(result).toContain('proficient');
  });

  it('classifies advanced tone (avg > 4.5)', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2 }, { word: '狗', reviewCount: 3 }, { word: '鸟', reviewCount: 1 },
    ]);
    const activity = [
      { type: 'quiz_graded', score: 5 }, { type: 'quiz_graded', score: 5 },
    ];
    const result = buildGradingContext(vocab, activity, 'zh');
    expect(result).toContain('advanced');
  });

  it('includes word counts', () => {
    const vocab = makeVocab([
      { word: '猫', reviewCount: 2, interval: 25 },
      { word: '狗', reviewCount: 3 },
      { word: '鸟', reviewCount: 1 },
    ]);
    const result = buildGradingContext(vocab, [], 'zh');
    expect(result).toContain('3 words known');
    expect(result).toContain('1 mastered');
  });

  it('respects 200-char cap', () => {
    const words = [];
    for (let i = 0; i < 30; i++) words.push({ word: `w${i}`, reviewCount: 2 });
    const vocab = makeVocab(words);
    const result = buildGradingContext(vocab, [], 'zh');
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('filters by langId', () => {
    const vocab = makeVocab([
      { word: '猫', langId: 'zh', reviewCount: 2 },
      { word: '狗', langId: 'zh', reviewCount: 3 },
      { word: 'cat', langId: 'en', reviewCount: 5 },
    ]);
    // Only 2 zh words — not enough
    expect(buildGradingContext(vocab, [], 'zh')).toBeNull();
  });
});

// ── buildReviewContext ───────────────────────────────────────

describe('buildReviewContext', () => {
  it('returns null with fewer than 3 completed lessons', () => {
    expect(buildReviewContext({}, {}, [], 'syl1', [0, 1], 'zh')).toBeNull();
  });

  it('returns null with no struggling words', () => {
    const vocab = { '猫': { langId: 'zh', interval: 30, reviewCount: 5, lapses: 0 } };
    const readers = {
      lesson_syl1_0: { vocabulary: [{ target: '猫' }] },
      lesson_syl1_1: { vocabulary: [] },
      lesson_syl1_2: { vocabulary: [] },
    };
    expect(buildReviewContext(vocab, readers, [], 'syl1', [0, 1, 2], 'zh')).toBeNull();
  });

  it('identifies struggling words cross-referenced with SRS data', () => {
    const vocab = {
      '猫': { langId: 'zh', interval: 1, reviewCount: 5, lapses: 3 },
      '狗': { langId: 'zh', interval: 30, reviewCount: 10, lapses: 0 },
    };
    const readers = {
      lesson_syl1_0: { vocabulary: [{ target: '猫' }, { target: '狗' }] },
      lesson_syl1_1: { vocabulary: [] },
      lesson_syl1_2: { vocabulary: [] },
    };
    const result = buildReviewContext(vocab, readers, [], 'syl1', [0, 1, 2], 'zh');
    expect(result).not.toBeNull();
    expect(result.strugglingWords).toContain('猫');
    expect(result.strugglingWords).not.toContain('狗');
  });

  it('identifies weak grammar from low quiz scores', () => {
    const vocab = { '猫': { langId: 'zh', interval: 0, reviewCount: 5, lapses: 3 } };
    const readers = {
      lesson_syl1_0: { vocabulary: [{ target: '猫' }], grammarNotes: [{ pattern: '把 construction' }] },
      lesson_syl1_1: { vocabulary: [] },
      lesson_syl1_2: { vocabulary: [] },
    };
    const activity = [
      { type: 'quiz_graded', lessonKey: 'lesson_syl1_0', score: 2 },
    ];
    const result = buildReviewContext(vocab, readers, activity, 'syl1', [0, 1, 2], 'zh');
    expect(result.weakGrammar).toContain('把 construction');
  });

  it('returns structured object with summary string', () => {
    const vocab = { '猫': { langId: 'zh', interval: 0, reviewCount: 5, lapses: 3 } };
    const readers = {
      lesson_syl1_0: { vocabulary: [{ target: '猫' }] },
      lesson_syl1_1: { vocabulary: [] },
      lesson_syl1_2: { vocabulary: [] },
    };
    const result = buildReviewContext(vocab, readers, [], 'syl1', [0, 1, 2], 'zh');
    expect(result).toHaveProperty('strugglingWords');
    expect(result).toHaveProperty('weakGrammar');
    expect(result).toHaveProperty('summary');
    expect(typeof result.summary).toBe('string');
  });
});

// ── getLevelUpRecommendation ─────────────────────────────────

describe('getLevelUpRecommendation', () => {
  function makeVocab(count, langId = 'zh', mastered = 0) {
    const vocab = {};
    for (let i = 0; i < count; i++) {
      vocab[`word${i}`] = {
        langId,
        reviewCount: 1,
        interval: i < mastered ? 30 : 5,
      };
    }
    return vocab;
  }

  it('returns null at max level (6)', () => {
    const vocab = makeVocab(10000, 'zh', 5000);
    const activity = [{ type: 'quiz_graded', score: 5 }];
    expect(getLevelUpRecommendation(vocab, activity, {}, 'zh', 6)).toBeNull();
  });

  it('returns null with too few words', () => {
    const vocab = makeVocab(10, 'zh');
    const activity = [{ type: 'quiz_graded', score: 5 }];
    expect(getLevelUpRecommendation(vocab, activity, {}, 'zh', 3)).toBeNull();
  });

  it('returns null with low quiz avg', () => {
    // HSK 3 → next is HSK 4 (threshold 1200). 70% = 840 words needed
    const vocab = makeVocab(900, 'zh', 400);
    const activity = [{ type: 'quiz_graded', score: 2 }];
    expect(getLevelUpRecommendation(vocab, activity, {}, 'zh', 3)).toBeNull();
  });

  it('returns confidence "ready" at 70% threshold + quiz >= 3.5', () => {
    // HSK 3 → next is HSK 4 (threshold 1200). 70% = 840.
    // Current level threshold = 600. 50% of 600 = 300 mastered needed.
    const vocab = makeVocab(850, 'zh', 350);
    const activity = [{ type: 'quiz_graded', score: 4 }, { type: 'quiz_graded', score: 4 }];
    const result = getLevelUpRecommendation(vocab, activity, {}, 'zh', 3);
    expect(result).not.toBeNull();
    expect(result.confidence).toBe('ready');
    expect(result.nextLabel).toBe('HSK 4');
  });

  it('returns confidence "almost" at 50% threshold + quiz >= 3.0', () => {
    // HSK 3 → next is HSK 4 (threshold 1200). 50% = 600.
    const vocab = makeVocab(620, 'zh', 100);
    const activity = [{ type: 'quiz_graded', score: 3 }, { type: 'quiz_graded', score: 3.5 }];
    const result = getLevelUpRecommendation(vocab, activity, {}, 'zh', 3);
    expect(result).not.toBeNull();
    expect(result.confidence).toBe('almost');
  });

  it('uses language-specific thresholds (TOPIK 3 = 3000 vs HSK 3 = 600)', () => {
    // TOPIK 3 → next is TOPIK 4 (threshold 5000). 70% = 3500.
    // For zh HSK 3 → HSK 4 (threshold 1200), 850 words would be "ready"
    const vocab = makeVocab(850, 'ko', 350);
    const activity = [{ type: 'quiz_graded', score: 4 }];
    // 850 is not enough for TOPIK 4 (need 3500 for ready)
    expect(getLevelUpRecommendation(vocab, activity, {}, 'ko', 3)).toBeNull();
  });
});

// ── getStreak ─────────────────────────────────────────────────

describe('getStreak', () => {
  it('returns 0 for empty activity', () => {
    expect(getStreak([])).toBe(0);
    expect(getStreak(null)).toBe(0);
    expect(getStreak(undefined)).toBe(0);
  });

  it('returns 1 for activity only today', () => {
    const now = Date.now();
    expect(getStreak([{ type: 'test', timestamp: now }])).toBe(1);
  });

  it('returns 1 for activity only yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getStreak([{ type: 'test', timestamp: yesterday.getTime() }])).toBe(1);
  });

  it('returns 2 for consecutive today + yesterday', () => {
    const now = Date.now();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getStreak([
      { type: 'test', timestamp: now },
      { type: 'test', timestamp: yesterday.getTime() },
    ])).toBe(2);
  });

  it('returns 0 when last activity is 2+ days ago', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(getStreak([{ type: 'test', timestamp: twoDaysAgo.getTime() }])).toBe(0);
  });

  it('counts consecutive days correctly', () => {
    const today = new Date();
    const activity = [];
    // 5 consecutive days ending today
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      activity.push({ type: 'test', timestamp: d.getTime() });
    }
    expect(getStreak(activity)).toBe(5);
  });

  it('stops counting at gap', () => {
    const today = new Date();
    const activity = [
      { type: 'test', timestamp: today.getTime() },
      { type: 'test', timestamp: new Date(today.getTime() - 1 * 86400000).getTime() },
      // gap: day -2 missing
      { type: 'test', timestamp: new Date(today.getTime() - 3 * 86400000).getTime() },
    ];
    expect(getStreak(activity)).toBe(2);
  });

  it('handles multiple activities on same day', () => {
    const now = Date.now();
    const activity = [
      { type: 'test', timestamp: now },
      { type: 'test', timestamp: now - 1000 },
      { type: 'test', timestamp: now - 2000 },
    ];
    expect(getStreak(activity)).toBe(1);
  });

  it('starts from yesterday when no activity today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(getStreak([
      { type: 'test', timestamp: yesterday.getTime() },
      { type: 'test', timestamp: twoDaysAgo.getTime() },
    ])).toBe(2);
  });
});

// ── getWordsByPeriod ──────────────────────────────────────────

describe('getWordsByPeriod', () => {
  it('returns empty array for null vocab', () => {
    expect(getWordsByPeriod(null)).toEqual([]);
  });

  it('returns 8 weekly buckets with zero counts for empty vocab', () => {
    const result = getWordsByPeriod({}, 'week');
    expect(result.length).toBe(8);
    result.forEach(b => expect(b.count).toBe(0));
  });

  it('places words added early this week in the current week bucket', () => {
    // Use the start of the current week (Sunday) to guarantee bucket 0
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    sunday.setHours(1, 0, 0, 0);
    const result = getWordsByPeriod({
      '猫': { dateAdded: sunday.toISOString() },
    }, 'week');
    const thisWeek = result.find(b => b.label === 'This wk');
    expect(thisWeek.count).toBe(1);
  });

  it('ignores words with no dateAdded', () => {
    const result = getWordsByPeriod({
      '猫': { pinyin: 'māo', english: 'cat' },
    }, 'week');
    result.forEach(b => expect(b.count).toBe(0));
  });

  it('returns 6 monthly buckets', () => {
    const result = getWordsByPeriod({}, 'month');
    expect(result.length).toBe(6);
  });
});

// ── computeStats ─────────────────────────────────────────────

describe('computeStats', () => {
  it('computes stats for empty state', () => {
    const state = {
      learnedVocabulary: {},
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.totalWords).toBe(0);
    expect(stats.avgQuizScore).toBeNull();
    expect(stats.totalLessons).toBe(0);
    expect(stats.completedLessons).toBe(0);
    expect(stats.readersGenerated).toBe(0);
    expect(stats.streak).toBe(0);
  });

  it('counts total words', () => {
    const state = {
      learnedVocabulary: { '猫': { langId: 'zh' }, '개': { langId: 'ko' } },
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.totalWords).toBe(2);
  });

  it('groups words by language', () => {
    const state = {
      learnedVocabulary: {
        '猫': { langId: 'zh' },
        '狗': { langId: 'zh' },
        '개': { langId: 'ko' },
      },
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.wordsByLang.zh).toBe(2);
    expect(stats.wordsByLang.ko).toBe(1);
  });

  it('defaults missing langId to zh', () => {
    const state = {
      learnedVocabulary: { '猫': { pinyin: 'māo' } },
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.wordsByLang.zh).toBe(1);
  });

  it('computes average quiz score', () => {
    const state = {
      learnedVocabulary: {},
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [
        { type: 'quiz_graded', score: 4, timestamp: Date.now() },
        { type: 'quiz_graded', score: 5, timestamp: Date.now() },
      ],
    };
    const stats = computeStats(state);
    expect(stats.avgQuizScore).toBe(4.5);
    expect(stats.quizCount).toBe(2);
  });

  it('counts lesson totals and completions', () => {
    const state = {
      learnedVocabulary: {},
      syllabi: [
        { id: 's1', lessons: [{ lesson_number: 1 }, { lesson_number: 2 }] },
      ],
      syllabusProgress: {
        s1: { lessonIndex: 1, completedLessons: [0] },
      },
      standaloneReaders: [{ key: 'sr1' }],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.totalLessons).toBe(2);
    expect(stats.completedLessons).toBe(1);
    expect(stats.syllabusCount).toBe(1);
    expect(stats.standaloneCount).toBe(1);
  });

  it('counts readers generated from activity', () => {
    const state = {
      learnedVocabulary: {},
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [
        { type: 'reader_generated', timestamp: Date.now() },
        { type: 'reader_generated', timestamp: Date.now() },
        { type: 'vocab_added', timestamp: Date.now() },
      ],
    };
    const stats = computeStats(state);
    expect(stats.readersGenerated).toBe(2);
  });

  it('computes flashcard mastery breakdown', () => {
    const state = {
      learnedVocabulary: {
        '猫': { langId: 'zh', reviewCount: 0 },         // new
        '狗': { langId: 'zh', reviewCount: 5, interval: 25 }, // mastered
        '鸟': { langId: 'zh', reviewCount: 2, interval: 3 },  // learning
      },
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.flashcardMastery.new).toBe(1);
    expect(stats.flashcardMastery.mastered).toBe(1);
    expect(stats.flashcardMastery.learning).toBe(1);
  });

  it('computes flashcard review stats', () => {
    const todayMs = Date.now();
    const state = {
      learnedVocabulary: {},
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [
        { type: 'flashcard_reviewed', judgment: 'got', timestamp: todayMs },
        { type: 'flashcard_reviewed', judgment: 'got', timestamp: todayMs },
        { type: 'flashcard_reviewed', judgment: 'missed', timestamp: todayMs },
      ],
    };
    const stats = computeStats(state);
    expect(stats.totalFlashcardReviews).toBe(3);
    expect(stats.reviewsToday).toBe(3);
    expect(stats.retentionRate).toBe(67); // 2/3
  });

  it('returns null retention rate with no flashcard reviews', () => {
    const state = {
      learnedVocabulary: {},
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learningActivity: [],
    };
    const stats = computeStats(state);
    expect(stats.retentionRate).toBeNull();
  });
});

// ── getFlashcardStreak ──────────────────────────────────────

describe('getFlashcardStreak', () => {
  it('returns 0 for empty activity', () => {
    expect(getFlashcardStreak([])).toBe(0);
    expect(getFlashcardStreak(null)).toBe(0);
  });

  it('returns 0 when no flashcard activities', () => {
    expect(getFlashcardStreak([
      { type: 'quiz_graded', timestamp: Date.now() },
    ])).toBe(0);
  });

  it('returns streak for consecutive flashcard review days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    expect(getFlashcardStreak([
      { type: 'flashcard_reviewed', timestamp: today.getTime() },
      { type: 'flashcard_reviewed', timestamp: yesterday.getTime() },
    ])).toBe(2);
  });

  it('ignores non-flashcard activities for streak', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    expect(getFlashcardStreak([
      { type: 'flashcard_reviewed', timestamp: today.getTime() },
      { type: 'quiz_graded', timestamp: yesterday.getTime() },
    ])).toBe(1);
  });
});

// ── computeDifficultyCalibration ────────────────────────────────

describe('computeDifficultyCalibration', () => {
  it('returns 0 for empty entries', () => {
    expect(computeDifficultyCalibration([], 3)).toBe(0);
    expect(computeDifficultyCalibration(null, 3)).toBe(0);
  });

  it('returns positive for all too_easy ratings', () => {
    const entries = [
      { rating: 'too_easy', level: 3 },
      { rating: 'too_easy', level: 3 },
    ];
    const result = computeDifficultyCalibration(entries, 3);
    expect(result).toBeGreaterThan(0.5);
  });

  it('returns negative for all too_difficult ratings', () => {
    const entries = [
      { rating: 'too_difficult', level: 3 },
      { rating: 'too_difficult', level: 3 },
    ];
    const result = computeDifficultyCalibration(entries, 3);
    expect(result).toBeLessThan(-0.5);
  });

  it('returns ~0 for all just_right ratings', () => {
    const entries = [
      { rating: 'just_right', level: 3 },
      { rating: 'just_right', level: 3 },
    ];
    const result = computeDifficultyCalibration(entries, 3);
    expect(result).toBe(0);
  });

  it('only considers entries matching current level', () => {
    const entries = [
      { rating: 'too_easy', level: 2 },
      { rating: 'too_difficult', level: 3 },
    ];
    const result = computeDifficultyCalibration(entries, 3);
    expect(result).toBeLessThan(0); // only the level-3 entry counts
  });

  it('weights recent ratings more heavily', () => {
    const entries = [
      { rating: 'too_difficult', level: 3 },
      { rating: 'too_easy', level: 3 },
      { rating: 'too_easy', level: 3 },
    ];
    const result = computeDifficultyCalibration(entries, 3);
    expect(result).toBeGreaterThan(0); // recent too_easy entries dominate
  });

  it('buildLearnerContext includes calibration text', () => {
    const vocab = {};
    for (let i = 0; i < 10; i++) {
      vocab[`word${i}`] = { langId: 'zh', reviewCount: 3, interval: 5, lapses: 0, dateAdded: new Date().toISOString() };
    }
    const feedback = {
      zh: [
        { rating: 'too_easy', level: 3 },
        { rating: 'too_easy', level: 3 },
        { rating: 'too_easy', level: 3 },
      ],
    };
    const result = buildLearnerContext(vocab, {}, [], 'zh', { difficultyFeedback: feedback, currentLevel: 3 });
    expect(result).toContain('easy');
  });
});
