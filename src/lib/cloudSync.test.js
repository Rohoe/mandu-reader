import { describe, it, expect, vi } from 'vitest';

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { detectConflict, mergeData } from './cloudSync';

// ── detectConflict ──────────────────────────────────────────

describe('detectConflict', () => {
  it('returns null when cloudData is null', () => {
    const result = detectConflict({ syllabi: [] }, null);
    expect(result).toBeNull();
  });

  it('returns null when data hashes match', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learnedVocabulary: {},
      learnedGrammar: {},
      exportedWords: new Set(),
      lastModified: 1000,
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      learned_grammar: {},
      exported_words: [],
      updated_at: new Date(1000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(result).toBeNull();
  });

  it('returns null when exportedWords Set matches cloud Array (regression)', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learnedVocabulary: {},
      learnedGrammar: {},
      exportedWords: new Set(['猫', '狗']),
      lastModified: 1000,
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      learned_grammar: {},
      exported_words: ['猫', '狗'],
      updated_at: new Date(1000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(result).toBeNull();
  });

  it('ignores demo readers when comparing hashes', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [
        { key: 'standalone_demo', topic: 'Demo', isDemo: true },
        { key: 'standalone_demo_en', topic: 'Demo EN', isDemo: true },
      ],
      learnedVocabulary: {},
      learnedGrammar: {},
      exportedWords: new Set(),
      lastModified: 1000,
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      learned_grammar: {},
      exported_words: [],
      updated_at: new Date(1000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(result).toBeNull();
  });

  it('returns conflict info when data differs', () => {
    const localState = {
      syllabi: [{ id: 's1', topic: 'local' }],
      syllabusProgress: {},
      standaloneReaders: [],
      learnedVocabulary: { '猫': { pinyin: 'māo' } },
      exportedWords: new Set(),
      lastModified: 2000,
    };
    const cloudData = {
      syllabi: [{ id: 's2', topic: 'cloud' }],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      exported_words: [],
      updated_at: new Date(1000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(result).not.toBeNull();
    expect(result.localSyllabusCount).toBe(1);
    expect(result.cloudSyllabusCount).toBe(1);
    expect(result.localVocabCount).toBe(1);
    expect(result.cloudVocabCount).toBe(0);
  });

  it('includes cloudNewer flag', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      learnedVocabulary: { '猫': {} },
      exportedWords: new Set(),
      lastModified: 1000,
    };
    const cloudData = {
      syllabi: [{ id: 's1' }],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      exported_words: [],
      updated_at: new Date(2000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(result.cloudNewer).toBe(true);
  });

  it('includes date strings', () => {
    const localState = {
      syllabi: [{ id: 'a' }],
      syllabusProgress: {},
      standaloneReaders: [],
      learnedVocabulary: {},
      exportedWords: new Set(),
      lastModified: 1000,
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      learned_vocabulary: {},
      exported_words: [],
      updated_at: new Date(2000).toISOString(),
    };
    const result = detectConflict(localState, cloudData);
    expect(typeof result.cloudDate).toBe('string');
    expect(typeof result.localDate).toBe('string');
  });
});

// ── mergeData ───────────────────────────────────────────────

describe('mergeData', () => {
  it('unions syllabi by id (local wins on conflict)', () => {
    const localState = {
      syllabi: [{ id: 's1', topic: 'local-topic' }],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [{ id: 's1', topic: 'cloud-topic' }, { id: 's2', topic: 'cloud-only' }],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.syllabi.length).toBe(2);
    const s1 = result.syllabi.find(s => s.id === 's1');
    expect(s1.topic).toBe('local-topic'); // local wins
    expect(result.syllabi.find(s => s.id === 's2')).toBeTruthy();
  });

  it('unions standalone readers by key', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [{ key: 'sr1', topic: 'local' }],
      generatedReaders: {},
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [{ key: 'sr2', topic: 'cloud' }],
      generated_readers: {},
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.standalone_readers.length).toBe(2);
  });

  it('merges vocabulary preferring newer dateAdded', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {
        '猫': { pinyin: 'māo', dateAdded: 2000 },
        '狗': { pinyin: 'gǒu', dateAdded: 1000 },
      },
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {
        '猫': { pinyin: 'māo-cloud', dateAdded: 1000 },
        '鱼': { pinyin: 'yú', dateAdded: 3000 },
      },
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.learned_vocabulary['猫'].dateAdded).toBe(2000); // local newer
    expect(result.learned_vocabulary['狗']).toBeTruthy(); // local only
    expect(result.learned_vocabulary['鱼']).toBeTruthy(); // cloud only
  });

  it('merges exported words as set union', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {},
      exportedWords: new Set(['猫', '狗']),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {},
      exported_words: ['狗', '鱼'],
    };
    const result = mergeData(localState, cloudData);
    expect(result.exported_words).toContain('猫');
    expect(result.exported_words).toContain('狗');
    expect(result.exported_words).toContain('鱼');
    expect(result.exported_words.length).toBe(3);
  });

  it('merges generated readers with local winning', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: { key1: { story: 'local-story' } },
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: { key1: { story: 'cloud-story' }, key2: { story: 'cloud-only' } },
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.generated_readers.key1.story).toBe('local-story');
    expect(result.generated_readers.key2.story).toBe('cloud-only');
  });

  it('handles identical local and cloud data (no duplicates)', () => {
    const localState = {
      syllabi: [{ id: 's1', topic: 'shared' }],
      syllabusProgress: { s1: { lessonIndex: 2, completedLessons: [0, 1] } },
      standaloneReaders: [{ key: 'sr1', topic: 'reader' }],
      generatedReaders: { key1: { story: 'same-story' } },
      learnedVocabulary: { '猫': { pinyin: 'māo', dateAdded: 1000 } },
      exportedWords: new Set(['猫']),
    };
    const cloudData = {
      syllabi: [{ id: 's1', topic: 'shared' }],
      syllabus_progress: { s1: { lessonIndex: 2, completedLessons: [0, 1] } },
      standalone_readers: [{ key: 'sr1', topic: 'reader' }],
      generated_readers: { key1: { story: 'same-story' } },
      learned_vocabulary: { '猫': { pinyin: 'māo', dateAdded: 1000 } },
      exported_words: ['猫'],
    };
    const result = mergeData(localState, cloudData);
    expect(result.syllabi.length).toBe(1);
    expect(result.standalone_readers.length).toBe(1);
    expect(Object.keys(result.learned_vocabulary).length).toBe(1);
    expect(result.exported_words.length).toBe(1);
  });

  it('merges overlapping syllabi with different lessons', () => {
    const localState = {
      syllabi: [
        { id: 's1', topic: 'topic-a', lessons: [{ title: 'L1' }] },
        { id: 's2', topic: 'local-only' },
      ],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [
        { id: 's1', topic: 'topic-a-cloud', lessons: [{ title: 'L1' }, { title: 'L2' }] },
        { id: 's3', topic: 'cloud-only' },
      ],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.syllabi.length).toBe(3);
    // Local wins for s1
    const s1 = result.syllabi.find(s => s.id === 's1');
    expect(s1.topic).toBe('topic-a');
    expect(result.syllabi.find(s => s.id === 's2')).toBeTruthy();
    expect(result.syllabi.find(s => s.id === 's3')).toBeTruthy();
  });

  it('handles vocabulary conflict with same word different translations', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {
        '猫': { pinyin: 'māo', english: 'cat (local)', dateAdded: 2000 },
      },
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {
        '猫': { pinyin: 'māo', english: 'cat (cloud)', dateAdded: 3000 },
      },
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    // Cloud is newer, so cloud wins
    expect(result.learned_vocabulary['猫'].english).toBe('cat (cloud)');
    expect(result.learned_vocabulary['猫'].dateAdded).toBe(3000);
  });

  it('excludes demo readers from merged standalone_readers and generated_readers', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: {},
      standaloneReaders: [
        { key: 'sr1', topic: 'real reader' },
        { key: 'standalone_demo', topic: 'Sample', isDemo: true },
      ],
      generatedReaders: {
        sr1: { story: 'real' },
        standalone_demo: { story: 'demo' },
        standalone_demo_en: { story: 'demo en' },
      },
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: {},
      standalone_readers: [
        { key: 'sr2', topic: 'cloud reader' },
        { key: 'standalone_demo_en', topic: 'Sample EN', isDemo: true },
      ],
      generated_readers: {
        sr2: { story: 'cloud' },
        standalone_demo: { story: 'demo cloud' },
      },
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.standalone_readers.length).toBe(2);
    expect(result.standalone_readers.map(r => r.key).sort()).toEqual(['sr1', 'sr2']);
    expect(result.generated_readers).toHaveProperty('sr1');
    expect(result.generated_readers).toHaveProperty('sr2');
    expect(result.generated_readers).not.toHaveProperty('standalone_demo');
    expect(result.generated_readers).not.toHaveProperty('standalone_demo_en');
  });

  it('cloud wins on conflict when prefer: cloud', () => {
    const localState = {
      syllabi: [{ id: 's1', topic: 'local-topic' }],
      syllabusProgress: {},
      standaloneReaders: [{ key: 'sr1', topic: 'local-reader' }],
      generatedReaders: { key1: { story: 'local-story' } },
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [{ id: 's1', topic: 'cloud-topic' }, { id: 's2', topic: 'cloud-only' }],
      syllabus_progress: {},
      standalone_readers: [{ key: 'sr1', topic: 'cloud-reader' }],
      generated_readers: { key1: { story: 'cloud-story' }, key2: { story: 'cloud-only' } },
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData, { prefer: 'cloud' });
    // Cloud wins for overlapping items
    expect(result.syllabi.find(s => s.id === 's1').topic).toBe('cloud-topic');
    expect(result.standalone_readers.find(r => r.key === 'sr1').topic).toBe('cloud-reader');
    expect(result.generated_readers.key1.story).toBe('cloud-story');
    // Union still includes cloud-only items
    expect(result.syllabi.find(s => s.id === 's2')).toBeTruthy();
    expect(result.generated_readers.key2.story).toBe('cloud-only');
  });

  it('merges syllabus progress with max lessonIndex and union completedLessons', () => {
    const localState = {
      syllabi: [],
      syllabusProgress: { s1: { lessonIndex: 3, completedLessons: [0, 1] } },
      standaloneReaders: [],
      generatedReaders: {},
      learnedVocabulary: {},
      exportedWords: new Set(),
    };
    const cloudData = {
      syllabi: [],
      syllabus_progress: { s1: { lessonIndex: 1, completedLessons: [0, 2] } },
      standalone_readers: [],
      generated_readers: {},
      learned_vocabulary: {},
      exported_words: [],
    };
    const result = mergeData(localState, cloudData);
    expect(result.syllabus_progress.s1.lessonIndex).toBe(3);
    expect(result.syllabus_progress.s1.completedLessons.sort()).toEqual([0, 1, 2]);
  });
});
