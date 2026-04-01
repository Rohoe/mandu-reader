import { describe, it, expect } from 'vitest';
import { validateImportedPath, exportPath, createLearningPath } from './learningPathSchema';

describe('validateImportedPath', () => {
  const validInput = {
    version: 1,
    type: 'learning_path',
    path: {
      title: 'Chinese History',
      langId: 'zh',
      level: 3,
      units: [
        { title: 'Warring States', description: 'Political conflict and philosophy' },
        { title: 'Qin Unification', description: 'The first emperor' },
      ],
    },
  };

  it('accepts a valid wrapped input', () => {
    const result = validateImportedPath(validInput);
    expect(result.valid).toBe(true);
    expect(result.path.title).toBe('Chinese History');
    expect(result.path.units).toHaveLength(2);
    expect(result.path.units[0].unitIndex).toBe(0);
    expect(result.path.units[0].status).toBe('pending');
    expect(result.path.units[0].syllabusId).toBeNull();
  });

  it('accepts a bare path object (no wrapper)', () => {
    const result = validateImportedPath(validInput.path);
    expect(result.valid).toBe(true);
    expect(result.path.title).toBe('Chinese History');
  });

  it('normalizes snake_case fields', () => {
    const input = {
      title: 'Test',
      lang_id: 'zh',
      level: 2,
      units: [{ title: 'U1', description: 'D1', estimated_lessons: 10, vocab_themes: ['food'] }],
    };
    const result = validateImportedPath(input);
    expect(result.valid).toBe(true);
    expect(result.path.units[0].estimatedLessons).toBe(10);
    expect(result.path.units[0].vocabThemes).toEqual(['food']);
  });

  it('rejects missing title', () => {
    const result = validateImportedPath({ langId: 'zh', level: 1, units: [{ title: 'U', description: 'D' }] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('title');
  });

  it('rejects empty units', () => {
    const result = validateImportedPath({ title: 'T', langId: 'zh', level: 1, units: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects null input', () => {
    const result = validateImportedPath(null);
    expect(result.valid).toBe(false);
  });

  it('defaults style to thematic for unknown values', () => {
    const input = {
      title: 'T', langId: 'zh', level: 1,
      units: [{ title: 'U', description: 'D', style: 'invalid' }],
    };
    const result = validateImportedPath(input);
    expect(result.path.units[0].style).toBe('thematic');
  });
});

describe('exportPath', () => {
  it('produces importable output', () => {
    const path = createLearningPath({
      title: 'Test Path',
      langId: 'zh',
      level: 3,
      units: [{ title: 'U1', description: 'D1', style: 'narrative' }],
    });
    const exported = exportPath(path);
    expect(exported.version).toBe(1);
    expect(exported.type).toBe('learning_path');

    // Round-trip: export → import
    const reimported = validateImportedPath(exported);
    expect(reimported.valid).toBe(true);
    expect(reimported.path.title).toBe('Test Path');
    expect(reimported.path.units[0].style).toBe('narrative');
  });
});

describe('createLearningPath', () => {
  it('creates a well-formed path', () => {
    const path = createLearningPath({
      title: 'Korean Drama Culture',
      langId: 'ko',
      level: 2,
      units: [
        { title: 'Historical Dramas', description: 'Sageuk genre', style: 'exploratory' },
        { title: 'Modern Romance', description: 'Rom-com vocabulary', estimated_lessons: 10 },
      ],
    });
    expect(path.id).toMatch(/^path_/);
    expect(path.units).toHaveLength(2);
    expect(path.units[0].unitIndex).toBe(0);
    expect(path.units[0].style).toBe('exploratory');
    expect(path.units[1].estimatedLessons).toBe(10);
    expect(path.coveredVocab).toEqual([]);
    expect(path.archived).toBe(false);
  });
});
