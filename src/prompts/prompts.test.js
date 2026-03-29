import { describe, it, expect } from 'vitest';
import { buildSyllabusPrompt } from './syllabusPrompt';
import { buildReaderSystem } from './readerSystemPrompt';
import { buildGradingSystem } from './gradingPrompt';
import { buildExtendSyllabusPrompt } from './extendSyllabusPrompt';
import { buildExtendNarrativeSyllabusPrompt } from './extendNarrativeSyllabusPrompt';
import { buildNarrativeSyllabusPrompt } from './narrativeSyllabusPrompt';
import { buildNarrativeReaderSystem, buildNarrativeContext } from './narrativeReaderPrompt';
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

// ── buildNarrativeSyllabusPrompt ────────────────────────────

describe('buildNarrativeSyllabusPrompt', () => {
  const sourceMaterial = { title: 'The Silk Road', author: '', period: '200 BCE - 1400 CE', description: '' };

  it('includes source material and level', () => {
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, sourceMaterial, 'historical', 3, 20);
    expect(prompt).toContain('The Silk Road');
    expect(prompt).toContain('200 BCE - 1400 CE');
    expect(prompt).toContain('HSK Level: 3');
    expect(prompt).toContain('20');
  });

  it('uses historian role for historical type', () => {
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, sourceMaterial, 'historical', 3, 10);
    expect(prompt).toContain('historian');
    expect(prompt).toContain('historically accurate');
  });

  it('uses literary scholar role for book type', () => {
    const bookSource = { title: 'Journey to the West', author: 'Wu Cheng\'en', period: '', description: '' };
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, bookSource, 'book', 4, 15);
    expect(prompt).toContain('literary scholar');
    expect(prompt).toContain('faithful to the source material');
    expect(prompt).toContain('Wu Cheng\'en');
  });

  it('includes segmentation and continuity instructions', () => {
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, sourceMaterial, 'historical', 3, 20);
    expect(prompt).toContain('future_arc');
    expect(prompt).toContain('continuity_notes');
    expect(prompt).toContain('narrative_arc');
  });

  it('requests JSON format with narrative fields', () => {
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, sourceMaterial, 'historical', 3, 10);
    expect(prompt).toContain('chapter_summary');
    expect(prompt).toContain('narrative_position');
    expect(prompt).toContain('characters');
    expect(prompt).toContain('settings');
    expect(prompt).toContain('Return ONLY valid JSON');
  });

  it('includes learner profile when provided', () => {
    const prompt = buildNarrativeSyllabusPrompt(zhConfig, sourceMaterial, 'historical', 3, 10, 'English', { learnerProfile: 'Knows 200 words' });
    expect(prompt).toContain('Knows 200 words');
    expect(prompt).toContain('Learner Profile');
  });

  it('uses correct title field key for Korean', () => {
    const prompt = buildNarrativeSyllabusPrompt(koConfig, sourceMaterial, 'historical', 2, 10);
    expect(prompt).toContain('title_ko');
    expect(prompt).toContain('TOPIK Level: 2');
  });
});

// ── buildNarrativeReaderSystem ──────────────────────────────

describe('buildNarrativeReaderSystem', () => {
  it('includes narrative continuity instructions', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Silk Road Ch1', '1100-1300', 1200);
    expect(prompt).toContain('NARRATIVE CONTINUITY');
    expect(prompt).toContain('maintain character names');
  });

  it('includes accuracy notes section for historical type', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200, 'English', { narrativeType: 'historical' });
    expect(prompt).toContain('### 7. Accuracy Notes');
    expect(prompt).toContain('accuracy-json');
    expect(prompt).toContain('### 8. Story So Far');
  });

  it('includes accuracy notes section for book type', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200, 'English', { narrativeType: 'book' });
    expect(prompt).toContain('### 7. Accuracy Notes');
    expect(prompt).toContain('### 8. Story So Far');
  });

  it('omits accuracy notes when narrativeType is absent', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200);
    expect(prompt).not.toContain('Accuracy Notes');
    expect(prompt).toContain('### 7. Story So Far');
  });

  it('includes story so far section', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200);
    expect(prompt).toContain('Story So Far');
    expect(prompt).toContain('Character updates');
  });

  it('includes standard sections', () => {
    const prompt = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '500-700', 600);
    expect(prompt).toContain('### 1. Title');
    expect(prompt).toContain('### 2. Story');
    expect(prompt).toContain('### 3. Vocabulary');
    expect(prompt).toContain('vocab-json');
    expect(prompt).toContain('### 4. Comprehension');
    expect(prompt).toContain('### 5. Grammar');
    expect(prompt).toContain('### 6. Suggested');
  });

  it('scales vocabulary range same as standard prompt', () => {
    const short = buildNarrativeReaderSystem(zhConfig, 1, 'Test', '100-200', 150);
    expect(short).toContain('3-5');
    const long = buildNarrativeReaderSystem(zhConfig, 3, 'Test', '1100-1300', 1200);
    expect(long).toContain('14-18');
  });
});

// ── buildNarrativeContext ───────────────────────────────────

describe('buildNarrativeContext', () => {
  const syllabus = {
    id: 'test_narr',
    topic: 'The Silk Road',
    narrativeArc: {
      characters: [
        { name: '张骞', role: 'Han dynasty explorer' },
        { name: '李商人', role: 'merchant' },
      ],
    },
    lessons: [
      { lesson_number: 1, title_en: 'Origins', chapter_summary: 'Zhang Qian sets out.', continuity_notes: 'Year: 138 BCE', setting: 'Chang\'an', characters: ['张骞'], narrative_position: 'setup' },
      { lesson_number: 2, title_en: 'The Journey', chapter_summary: 'Captured by Xiongnu.', continuity_notes: 'Held for 10 years', setting: 'Xiongnu territory', characters: ['张骞'], narrative_position: 'rising' },
      { lesson_number: 3, title_en: 'Escape', chapter_summary: 'Zhang Qian escapes.', continuity_notes: 'Reached Dayuan', setting: 'Central Asia', characters: ['张骞', '李商人'], narrative_position: 'rising' },
    ],
  };

  const readers = {
    'lesson_test_narr_0': { narrativeState: { runningSummary: 'Zhang Qian left Chang\'an in 138 BCE.', characterUpdates: 'Zhang Qian introduced' } },
    'lesson_test_narr_1': { narrativeState: { runningSummary: 'Zhang Qian was captured by Xiongnu and held for 10 years.', characterUpdates: '' } },
  };

  it('includes chapter header and characters', () => {
    const ctx = buildNarrativeContext(syllabus, readers, 2);
    expect(ctx).toContain('chapter 3 of 3');
    expect(ctx).toContain('The Silk Road');
    expect(ctx).toContain('张骞 (Han dynasty explorer)');
    expect(ctx).toContain('李商人 (merchant)');
  });

  it('includes deep tier for recent chapters', () => {
    const ctx = buildNarrativeContext(syllabus, readers, 2);
    expect(ctx).toContain('Captured by Xiongnu');
    expect(ctx).toContain('Held for 10 years');
  });

  it('includes current lesson plan', () => {
    const ctx = buildNarrativeContext(syllabus, readers, 2);
    expect(ctx).toContain('Zhang Qian escapes');
    expect(ctx).toContain('Central Asia');
    expect(ctx).toContain('Reached Dayuan');
  });

  it('handles first lesson (no prior context)', () => {
    const ctx = buildNarrativeContext(syllabus, readers, 0);
    expect(ctx).toContain('chapter 1 of 3');
    expect(ctx).toContain('Zhang Qian sets out');
    expect(ctx).not.toContain('Previous chapters');
  });

  it('handles missing readers gracefully', () => {
    const ctx = buildNarrativeContext(syllabus, {}, 2);
    expect(ctx).toContain('chapter 3 of 3');
    expect(ctx).toContain('Captured by Xiongnu');
    // Should still work with lesson metadata even without reader data
  });
});

// ── buildExtendNarrativeSyllabusPrompt ──────────────────────

describe('buildExtendNarrativeSyllabusPrompt', () => {
  const narrativeSyllabus = {
    topic: 'The Silk Road',
    level: 3,
    langId: 'zh',
    narrativeType: 'historical',
    narrativeArc: {
      overview: 'A journey along the Silk Road.',
      characters: [{ name: '张骞', role: 'explorer' }],
      settings: ['Chang\'an', 'Central Asia'],
    },
    futureArc: {
      summary: 'Trade expansion and cultural exchange.',
      segments: [
        { start_lesson: 4, end_lesson: 6, arc_phase: 'rising', summary: 'Trade routes expand' },
        { start_lesson: 7, end_lesson: 9, arc_phase: 'climax', summary: 'Peak of the Silk Road' },
      ],
    },
    lessons: [
      { lesson_number: 1, title_en: 'Origins', chapter_summary: 'Zhang Qian sets out.', continuity_notes: 'Year: 138 BCE' },
      { lesson_number: 2, title_en: 'The Journey', chapter_summary: 'Captured by Xiongnu.', continuity_notes: 'Held for 10 years' },
      { lesson_number: 3, title_en: 'Escape', chapter_summary: 'Zhang Qian escapes.', continuity_notes: 'Reached Dayuan' },
    ],
  };

  it('includes narrative arc context', () => {
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, narrativeSyllabus, 3);
    expect(prompt).toContain('A journey along the Silk Road');
    expect(prompt).toContain('张骞 (explorer)');
  });

  it('includes last lesson continuity', () => {
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, narrativeSyllabus, 3);
    expect(prompt).toContain('Zhang Qian escapes');
    expect(prompt).toContain('Reached Dayuan');
  });

  it('includes future arc roadmap when available', () => {
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, narrativeSyllabus, 3);
    expect(prompt).toContain('Pre-Planned Roadmap');
    expect(prompt).toContain('Trade routes expand');
  });

  it('uses continuation mode when no futureArc', () => {
    const noFuture = { ...narrativeSyllabus, futureArc: null };
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, noFuture, 3);
    expect(prompt).toContain('Continuation');
    expect(prompt).not.toContain('Pre-Planned Roadmap');
  });

  it('numbers new lessons after existing', () => {
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, narrativeSyllabus, 3);
    expect(prompt).toContain('numbered 4–6');
  });

  it('uses historian role for historical type', () => {
    const prompt = buildExtendNarrativeSyllabusPrompt(zhConfig, narrativeSyllabus, 3);
    expect(prompt).toContain('historian');
  });
});
