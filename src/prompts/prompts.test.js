import { describe, it, expect } from 'vitest';
import { buildSyllabusPrompt } from './syllabusPrompt';
import { buildReaderSystem } from './readerSystemPrompt';
import { buildGradingSystem } from './gradingPrompt';
import { buildExtendSyllabusPrompt } from './extendSyllabusPrompt';
import { getLang } from '../lib/languages';

const zhConfig = getLang('zh');
const koConfig = getLang('ko');
const yueConfig = getLang('yue');

// ── buildSyllabusPrompt ──────────────────────────────────────

describe('buildSyllabusPrompt', () => {
  it('includes topic and level for Chinese', () => {
    const prompt = buildSyllabusPrompt(zhConfig, 'Street food', 3, 6);
    expect(prompt).toContain('Street food');
    expect(prompt).toContain('HSK Level: 3');
    expect(prompt).toContain('Number of lessons: 6');
    expect(prompt).toContain('title_zh');
  });

  it('uses TOPIK for Korean', () => {
    const prompt = buildSyllabusPrompt(koConfig, 'K-drama', 2, 4);
    expect(prompt).toContain('TOPIK Level: 2');
    expect(prompt).toContain('title_ko');
  });

  it('uses YUE for Cantonese', () => {
    const prompt = buildSyllabusPrompt(yueConfig, 'Dim sum', 3, 5);
    expect(prompt).toContain('YUE Level: 3');
    expect(prompt).toContain('title_yue');
  });

  it('requests JSON format', () => {
    const prompt = buildSyllabusPrompt(zhConfig, 'Test', 1, 3);
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('summary');
    expect(prompt).toContain('lessons');
  });
});

// ── buildReaderSystem ────────────────────────────────────────

describe('buildReaderSystem', () => {
  it('includes character range and topic', () => {
    const prompt = buildReaderSystem(zhConfig, 3, 'Markets', '1100-1300', 1200);
    expect(prompt).toContain('1100-1300');
    expect(prompt).toContain('Markets');
    expect(prompt).toContain('HSK 3');
  });

  it('scales vocabulary to short readers', () => {
    const short = buildReaderSystem(zhConfig, 1, 'Test', '100-200', 150);
    expect(short).toContain('3-5');  // vocab range for short readers
  });

  it('scales vocabulary to longer readers', () => {
    const long = buildReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200);
    expect(long).toContain('14-18'); // vocab range for longer readers (1200 chars)
  });

  it('includes section headings', () => {
    const prompt = buildReaderSystem(zhConfig, 2, 'Test', '500-700', 600);
    expect(prompt).toContain('### 1. Title');
    expect(prompt).toContain('### 2. Story');
    expect(prompt).toContain('### 3. Vocabulary');
    expect(prompt).toContain('### 4. Comprehension');
    expect(prompt).toContain('### 5. Grammar');
    expect(prompt).toContain('### 6. Suggested');
  });

  it('includes vocab-json block in prompt', () => {
    const prompt = buildReaderSystem(zhConfig, 2, 'Test', '500-700', 600);
    expect(prompt).toContain('```vocab-json');
    expect(prompt).not.toContain('```anki-json');
  });

  it('uses Korean config correctly', () => {
    const prompt = buildReaderSystem(koConfig, 2, 'K-pop', '500-700', 600);
    expect(prompt).toContain('Korean');
    expect(prompt).toContain('TOPIK 2');
    expect(prompt).toContain('Korean syllables');
  });

  it('uses basic comprehension for beginner levels (0-2)', () => {
    for (const level of [0, 1, 2]) {
      const prompt = buildReaderSystem(zhConfig, level, 'Test', '500-700', 600);
      expect(prompt).toContain('direct factual recall');
      expect(prompt).toContain('explicitly stated in the text');
      expect(prompt).not.toContain('higher-order thinking');
    }
  });

  it('uses inferential questions for intermediate levels (3-4)', () => {
    for (const level of [3, 4]) {
      const prompt = buildReaderSystem(zhConfig, level, 'Test', '500-700', 600);
      expect(prompt).toContain('inferential thinking');
      expect(prompt).toContain('cause-and-effect');
      expect(prompt).not.toContain('direct factual recall');
    }
  });

  it('uses higher-order thinking for advanced levels (5-6)', () => {
    for (const level of [5, 6]) {
      const prompt = buildReaderSystem(zhConfig, level, 'Test', '500-700', 600);
      expect(prompt).toContain('higher-order thinking');
      expect(prompt).toContain('inference, synthesis, and interpretation');
      expect(prompt).not.toContain('direct factual recall');
    }
  });
});

// ── buildGradingSystem ──────────────────────────────────────

describe('buildGradingSystem', () => {
  it('includes proficiency level', () => {
    const prompt = buildGradingSystem(zhConfig, 3);
    expect(prompt).toContain('HSK level 3');
    expect(prompt).toContain('Mandarin');
  });

  it('requests JSON format', () => {
    const prompt = buildGradingSystem(zhConfig, 2);
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('overallScore');
    expect(prompt).toContain('feedback');
  });

  it('uses Korean grading context', () => {
    const prompt = buildGradingSystem(koConfig, 3);
    expect(prompt).toContain('Korean language teacher');
    expect(prompt).toContain('TOPIK level 3');
  });
});

// ── buildExtendSyllabusPrompt ────────────────────────────────

describe('buildExtendSyllabusPrompt', () => {
  const existingLessons = [
    { title_en: 'Spring Festival', title_zh: '春节', lesson_number: 1 },
    { title_en: 'Mid-Autumn', title_zh: '中秋节', lesson_number: 2 },
  ];

  it('includes existing lesson titles', () => {
    const prompt = buildExtendSyllabusPrompt(zhConfig, 'Festivals', 3, existingLessons, 3);
    expect(prompt).toContain('Spring Festival');
    expect(prompt).toContain('Mid-Autumn');
  });

  it('numbers new lessons after existing', () => {
    const prompt = buildExtendSyllabusPrompt(zhConfig, 'Festivals', 3, existingLessons, 3);
    expect(prompt).toContain('numbered 3–5');
  });

  it('includes count of new lessons', () => {
    const prompt = buildExtendSyllabusPrompt(zhConfig, 'Festivals', 3, existingLessons, 4);
    expect(prompt).toContain('4 NEW lessons');
  });
});
