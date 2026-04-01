import { describe, it, expect } from 'vitest';
import { getNextActions } from './nextActions';

function buildState(overrides = {}) {
  return {
    learnedVocabulary: {},
    learnedGrammar: {},
    syllabi: [],
    syllabusProgress: {},
    standaloneReaders: [],
    generatedReaders: {},
    learningActivity: [],
    ...overrides,
  };
}

describe('getNextActions', () => {
  it('returns empty when no data', () => {
    const actions = getNextActions(buildState(), { context: 'post-lesson' });
    expect(actions).toEqual([]);
  });

  it('suggests flashcards when cards are due', () => {
    const vocab = {
      hello: { reviewCount: 3, interval: 1, nextReview: '2020-01-01', lapses: 0, langId: 'zh' },
    };
    const actions = getNextActions(buildState({ learnedVocabulary: vocab }));
    expect(actions[0].type).toBe('flashcards');
    expect(actions[0].count).toBe(1);
  });

  it('suggests continue lesson for in-progress syllabus', () => {
    const state = buildState({
      syllabi: [{ id: 's1', topic: 'Food', lessons: [{ title_en: 'L1' }, { title_en: 'L2' }] }],
      syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [0] } },
    });
    const actions = getNextActions(state);
    const cont = actions.find(a => a.type === 'continue_lesson');
    expect(cont).toBeTruthy();
    expect(cont.topic).toBe('Food');
  });

  it('prioritizes flashcards over continue lesson', () => {
    const vocab = {
      hello: { reviewCount: 3, interval: 1, nextReview: '2020-01-01', lapses: 0, langId: 'zh' },
    };
    const state = buildState({
      learnedVocabulary: vocab,
      syllabi: [{ id: 's1', topic: 'Food', lessons: [{ title_en: 'L1' }] }],
      syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [] } },
    });
    const actions = getNextActions(state);
    expect(actions[0].type).toBe('flashcards');
  });

  it('includes create_new on dashboard', () => {
    const actions = getNextActions(buildState(), { context: 'dashboard' });
    const create = actions.find(a => a.type === 'create_new');
    expect(create).toBeTruthy();
  });

  it('excludes create_new on post-lesson', () => {
    const actions = getNextActions(buildState(), { context: 'post-lesson' });
    const create = actions.find(a => a.type === 'create_new');
    expect(create).toBeUndefined();
  });

  it('respects maxResults', () => {
    const vocab = {
      hello: { reviewCount: 3, interval: 1, nextReview: '2020-01-01', lapses: 0, langId: 'zh' },
    };
    const state = buildState({
      learnedVocabulary: vocab,
      syllabi: [{ id: 's1', topic: 'Food', lessons: [{ title_en: 'L1' }] }],
      syllabusProgress: { s1: { lessonIndex: 0, completedLessons: [] } },
    });
    const actions = getNextActions(state, { maxResults: 1 });
    expect(actions.length).toBe(1);
  });
});
