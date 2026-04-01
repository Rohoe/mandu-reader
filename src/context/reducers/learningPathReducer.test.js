import { describe, it, expect } from 'vitest';
import { learningPathReducer } from './learningPathReducer';
import {
  ADD_LEARNING_PATH, UPDATE_LEARNING_PATH, REMOVE_LEARNING_PATH,
  UNDO_REMOVE_LEARNING_PATH, SET_PATH_UNIT_SYLLABUS, UPDATE_PATH_COVERAGE,
  EXTEND_LEARNING_PATH, REORDER_PATH_UNITS, UPDATE_PATH_UNIT,
  ARCHIVE_LEARNING_PATH, UNARCHIVE_LEARNING_PATH,
} from '../actionTypes';

const makePath = (overrides = {}) => ({
  id: 'path_test1',
  title: 'Chinese History',
  description: 'A journey through Chinese history',
  langId: 'zh',
  level: 3,
  nativeLang: 'en',
  profile: null,
  units: [
    { unitIndex: 0, title: 'Warring States', description: 'desc', estimatedLessons: 8, style: 'narrative', vocabThemes: [], sourceMaterial: null, syllabusId: null, status: 'pending' },
    { unitIndex: 1, title: 'Qin Dynasty', description: 'desc', estimatedLessons: 6, style: 'thematic', vocabThemes: [], sourceMaterial: null, syllabusId: null, status: 'pending' },
  ],
  coveredVocab: [],
  coveredTopics: [],
  coveredGrammar: [],
  continuationContext: null,
  createdAt: 1000,
  updatedAt: 1000,
  archived: false,
  ...overrides,
});

const makeState = (paths = [makePath()]) => ({
  learningPaths: paths,
  _recentlyDeleted: null,
});

describe('learningPathReducer', () => {
  it('returns undefined for unknown actions', () => {
    expect(learningPathReducer(makeState(), { type: 'UNKNOWN' })).toBeUndefined();
  });

  it('ADD_LEARNING_PATH prepends', () => {
    const state = makeState([]);
    const path = makePath();
    const next = learningPathReducer(state, { type: ADD_LEARNING_PATH, payload: path });
    expect(next.learningPaths).toHaveLength(1);
    expect(next.learningPaths[0].id).toBe('path_test1');
  });

  it('UPDATE_LEARNING_PATH merges fields', () => {
    const next = learningPathReducer(makeState(), {
      type: UPDATE_LEARNING_PATH,
      payload: { id: 'path_test1', title: 'Updated Title' },
    });
    expect(next.learningPaths[0].title).toBe('Updated Title');
    expect(next.learningPaths[0].updatedAt).toBeGreaterThan(1000);
  });

  it('REMOVE + UNDO round-trips', () => {
    const state = makeState();
    const removed = learningPathReducer(state, { type: REMOVE_LEARNING_PATH, payload: 'path_test1' });
    expect(removed.learningPaths).toHaveLength(0);
    expect(removed._recentlyDeleted.kind).toBe('learningPath');

    const restored = learningPathReducer(removed, { type: UNDO_REMOVE_LEARNING_PATH });
    expect(restored.learningPaths).toHaveLength(1);
    expect(restored._recentlyDeleted).toBeNull();
  });

  it('SET_PATH_UNIT_SYLLABUS links syllabus', () => {
    const next = learningPathReducer(makeState(), {
      type: SET_PATH_UNIT_SYLLABUS,
      payload: { pathId: 'path_test1', unitIndex: 0, syllabusId: 'syl_abc' },
    });
    expect(next.learningPaths[0].units[0].syllabusId).toBe('syl_abc');
    expect(next.learningPaths[0].units[0].status).toBe('generated');
    expect(next.learningPaths[0].units[1].status).toBe('pending');
  });

  it('UPDATE_PATH_COVERAGE deduplicates', () => {
    const state = makeState([makePath({ coveredVocab: ['hello'] })]);
    const next = learningPathReducer(state, {
      type: UPDATE_PATH_COVERAGE,
      payload: { pathId: 'path_test1', vocab: ['hello', 'world'], topics: ['history'], grammar: [] },
    });
    expect(next.learningPaths[0].coveredVocab).toEqual(['hello', 'world']);
    expect(next.learningPaths[0].coveredTopics).toEqual(['history']);
  });

  it('EXTEND_LEARNING_PATH appends units with correct indices', () => {
    const next = learningPathReducer(makeState(), {
      type: EXTEND_LEARNING_PATH,
      payload: {
        pathId: 'path_test1',
        newUnits: [{ title: 'Han Dynasty', description: 'desc' }],
      },
    });
    expect(next.learningPaths[0].units).toHaveLength(3);
    expect(next.learningPaths[0].units[2].unitIndex).toBe(2);
    expect(next.learningPaths[0].units[2].title).toBe('Han Dynasty');
    expect(next.learningPaths[0].units[2].status).toBe('pending');
  });

  it('REORDER_PATH_UNITS reorders and reindexes', () => {
    const next = learningPathReducer(makeState(), {
      type: REORDER_PATH_UNITS,
      payload: { pathId: 'path_test1', unitOrder: [1, 0] },
    });
    expect(next.learningPaths[0].units[0].title).toBe('Qin Dynasty');
    expect(next.learningPaths[0].units[0].unitIndex).toBe(0);
    expect(next.learningPaths[0].units[1].title).toBe('Warring States');
    expect(next.learningPaths[0].units[1].unitIndex).toBe(1);
  });

  it('UPDATE_PATH_UNIT updates specific unit', () => {
    const next = learningPathReducer(makeState(), {
      type: UPDATE_PATH_UNIT,
      payload: { pathId: 'path_test1', unitIndex: 1, title: 'First Emperor', style: 'narrative' },
    });
    expect(next.learningPaths[0].units[1].title).toBe('First Emperor');
    expect(next.learningPaths[0].units[1].style).toBe('narrative');
    expect(next.learningPaths[0].units[0].title).toBe('Warring States');
  });

  it('ARCHIVE / UNARCHIVE toggles', () => {
    const archived = learningPathReducer(makeState(), { type: ARCHIVE_LEARNING_PATH, payload: 'path_test1' });
    expect(archived.learningPaths[0].archived).toBe(true);
    const unarchived = learningPathReducer(archived, { type: UNARCHIVE_LEARNING_PATH, payload: 'path_test1' });
    expect(unarchived.learningPaths[0].archived).toBe(false);
  });
});
