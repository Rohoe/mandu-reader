import { describe, it, expect, vi } from 'vitest';
import { splitSentence } from './sentenceSplitter';

// Mock languages.js — only scriptType matters
vi.mock('../../lib/languages', () => ({
  getLang: (id) => {
    const map = {
      zh: { scriptType: 'cjk' },
      yue: { scriptType: 'cjk' },
      ko: { scriptType: 'syllabic' },
      fr: { scriptType: 'latin' },
      es: { scriptType: 'latin' },
      en: { scriptType: 'latin' },
    };
    return map[id] || { scriptType: 'latin' };
  },
}));

describe('splitSentence', () => {
  // ── CJK (Chinese) ──────────────────────────────────────────
  it('splits Chinese into per-character tiles', () => {
    expect(splitSentence('我喜欢猫', 'zh')).toEqual(['我', '喜', '欢', '猫']);
  });

  it('attaches Chinese punctuation to preceding character', () => {
    expect(splitSentence('你好，世界！', 'zh')).toEqual(['你', '好，', '世', '界！']);
  });

  it('handles Cantonese the same as Chinese', () => {
    expect(splitSentence('我鍾意貓', 'yue')).toEqual(['我', '鍾', '意', '貓']);
  });

  it('handles sentence-final period', () => {
    expect(splitSentence('今天很好。', 'zh')).toEqual(['今', '天', '很', '好。']);
  });

  it('returns empty array for empty string', () => {
    expect(splitSentence('', 'zh')).toEqual([]);
  });

  it('returns empty array for null/undefined', () => {
    expect(splitSentence(null, 'zh')).toEqual([]);
    expect(splitSentence(undefined, 'zh')).toEqual([]);
  });

  // ── Latin (French, Spanish, English) ───────────────────────
  it('splits French by whitespace', () => {
    expect(splitSentence('Je suis content', 'fr')).toEqual(['Je', 'suis', 'content']);
  });

  it('splits Spanish by whitespace', () => {
    expect(splitSentence('Me gusta el café', 'es')).toEqual(['Me', 'gusta', 'el', 'café']);
  });

  it('splits English by whitespace', () => {
    expect(splitSentence('I like cats', 'en')).toEqual(['I', 'like', 'cats']);
  });

  it('handles multiple spaces', () => {
    expect(splitSentence('hello   world', 'en')).toEqual(['hello', 'world']);
  });

  // ── Korean (syllabic) ──────────────────────────────────────
  it('splits Korean by whitespace', () => {
    expect(splitSentence('나는 고양이를 좋아해요', 'ko')).toEqual(['나는', '고양이를', '좋아해요']);
  });

  // ── Unknown language falls back to whitespace ──────────────
  it('falls back to whitespace splitting for unknown language', () => {
    expect(splitSentence('one two three', 'xx')).toEqual(['one', 'two', 'three']);
  });
});
