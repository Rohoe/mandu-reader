import { describe, it, expect } from 'vitest';
import { checkMilestones } from './milestones';

function buildState(overrides = {}) {
  return {
    learnedVocabulary: {},
    learningActivity: [],
    syllabi: [],
    shownMilestones: new Set(),
    ...overrides,
  };
}

describe('checkMilestones', () => {
  it('returns empty for new user', () => {
    expect(checkMilestones(buildState())).toEqual([]);
  });

  it('detects vocab threshold', () => {
    const vocab = {};
    for (let i = 0; i < 10; i++) vocab[`word${i}`] = { langId: 'zh' };
    const milestones = checkMilestones(buildState({ learnedVocabulary: vocab }));
    expect(milestones.some(m => m.id === 'vocab_10')).toBe(true);
  });

  it('detects multiple vocab thresholds', () => {
    const vocab = {};
    for (let i = 0; i < 50; i++) vocab[`word${i}`] = { langId: 'zh' };
    const milestones = checkMilestones(buildState({ learnedVocabulary: vocab }));
    expect(milestones.some(m => m.id === 'vocab_10')).toBe(true);
    expect(milestones.some(m => m.id === 'vocab_25')).toBe(true);
    expect(milestones.some(m => m.id === 'vocab_50')).toBe(true);
  });

  it('filters out already-shown milestones', () => {
    const vocab = {};
    for (let i = 0; i < 10; i++) vocab[`word${i}`] = { langId: 'zh' };
    const milestones = checkMilestones(buildState({
      learnedVocabulary: vocab,
      shownMilestones: new Set(['vocab_10']),
    }));
    expect(milestones.some(m => m.id === 'vocab_10')).toBe(false);
  });

  it('detects first_lesson milestone', () => {
    const milestones = checkMilestones(buildState({
      learningActivity: [{ type: 'lesson_completed', timestamp: Date.now() }],
    }));
    expect(milestones.some(m => m.id === 'first_lesson')).toBe(true);
  });

  it('detects first_quiz milestone', () => {
    const milestones = checkMilestones(buildState({
      learningActivity: [{ type: 'quiz_graded', timestamp: Date.now() }],
    }));
    expect(milestones.some(m => m.id === 'first_quiz')).toBe(true);
  });

  it('detects first_syllabus milestone', () => {
    const milestones = checkMilestones(buildState({
      syllabi: [{ id: 's1', topic: 'test' }],
    }));
    expect(milestones.some(m => m.id === 'first_syllabus')).toBe(true);
  });

  it('skips demo syllabi for first_syllabus', () => {
    const milestones = checkMilestones(buildState({
      syllabi: [{ id: 's1', topic: 'demo', isDemo: true }],
    }));
    expect(milestones.some(m => m.id === 'first_syllabus')).toBe(false);
  });
});
