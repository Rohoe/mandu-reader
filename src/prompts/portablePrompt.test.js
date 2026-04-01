import { describe, it, expect } from 'vitest';
import { buildPortablePrompt, buildInteractiveDesignPrompt, buildImportInstructions } from './portablePrompt';

describe('buildPortablePrompt', () => {
  it('includes language and level', () => {
    const result = buildPortablePrompt({ level: 3, langId: 'zh', interests: 'history' }, 'Mandarin Chinese');
    expect(result).toContain('Mandarin Chinese');
    expect(result).toContain('level 3');
    expect(result).toContain('history');
  });

  it('includes optional profile fields when provided', () => {
    const result = buildPortablePrompt({
      level: 2, langId: 'ko',
      interests: 'K-drama', goals: 'reading fluency',
      commitment: 'regular', priorKnowledge: 'Hangul basics',
      freeText: 'I like historical fiction',
    }, 'Korean');
    expect(result).toContain('K-drama');
    expect(result).toContain('reading fluency');
    expect(result).toContain('3-4 sessions/week');
    expect(result).toContain('Hangul basics');
    expect(result).toContain('historical fiction');
  });

  it('includes JSON schema structure', () => {
    const result = buildPortablePrompt({ level: 1, langId: 'fr' }, 'French');
    expect(result).toContain('"units"');
    expect(result).toContain('"style"');
    expect(result).toContain('"vocab_themes"');
    expect(result).toContain('"source_material"');
  });
});

describe('buildInteractiveDesignPrompt', () => {
  it('includes language name', () => {
    const result = buildInteractiveDesignPrompt('Mandarin Chinese');
    expect(result).toContain('Mandarin Chinese');
  });

  it('includes interview instructions', () => {
    const result = buildInteractiveDesignPrompt('Korean', 'English');
    expect(result).toContain('Phase 1: Interview');
    expect(result).toContain('one question at a time');
    expect(result).toContain('waiting for');
  });

  it('includes the JSON schema for import', () => {
    const result = buildInteractiveDesignPrompt('French', 'English');
    expect(result).toContain('"version": 1');
    expect(result).toContain('"type": "learning_path"');
    expect(result).toContain('"units"');
    expect(result).toContain('"langId"');
    expect(result).toContain('"vocab_themes"');
  });

  it('uses native language name for descriptions', () => {
    const result = buildInteractiveDesignPrompt('Mandarin Chinese', '中文');
    expect(result).toContain('中文');
  });

  it('defaults native language to English', () => {
    const result = buildInteractiveDesignPrompt('Spanish');
    expect(result).toContain('English');
  });

  it('includes Phase 2 (present plan) and Phase 3 (output JSON)', () => {
    const result = buildInteractiveDesignPrompt('Korean');
    expect(result).toContain('Phase 2');
    expect(result).toContain('Phase 3');
  });

  it('includes import instructions at the end', () => {
    const result = buildInteractiveDesignPrompt('French');
    expect(result).toContain('Import');
    expect(result).toContain('Mandu');
  });

  it('includes all valid langId codes', () => {
    const result = buildInteractiveDesignPrompt('Chinese');
    expect(result).toContain('"zh"');
    expect(result).toContain('"yue"');
    expect(result).toContain('"ko"');
    expect(result).toContain('"fr"');
    expect(result).toContain('"es"');
    expect(result).toContain('"en"');
  });
});

describe('buildImportInstructions', () => {
  it('returns import steps', () => {
    const result = buildImportInstructions();
    expect(result).toContain('Mandu');
    expect(result).toContain('Import');
  });
});
