import { describe, it, expect } from 'vitest';
import { generateGrammarCloze } from './grammarCloze';

describe('generateGrammarCloze', () => {
  it('blanks CJK pattern cores', () => {
    const result = generateGrammarCloze('V + 到', '我听到了一个好消息');
    expect(result.matchFound).toBe(true);
    expect(result.answers).toContain('到');
    expect(result.blankedSentence).toContain('____');
    expect(result.blankedSentence).not.toContain('到');
  });

  it('handles 把…V了 pattern', () => {
    const result = generateGrammarCloze('把…V了', '我把书看了');
    expect(result.matchFound).toBe(true);
    expect(result.answers).toContain('把');
    expect(result.answers).toContain('了');
  });

  it('handles Korean pattern', () => {
    const result = generateGrammarCloze('-는 것', '공부하는 것이 중요합니다');
    expect(result.matchFound).toBe(true);
    expect(result.blankedSentence).toContain('____');
  });

  it('handles CEFR pattern', () => {
    const result = generateGrammarCloze('ne...pas', 'Je ne sais pas');
    expect(result.matchFound).toBe(true);
  });

  it('returns matchFound=false when no cores match', () => {
    const result = generateGrammarCloze('V + 了', 'Hello world');
    expect(result.matchFound).toBe(false);
    expect(result.blankedSentence).toBe('Hello world');
  });

  it('handles null/empty inputs', () => {
    expect(generateGrammarCloze(null, 'test').matchFound).toBe(false);
    expect(generateGrammarCloze('V', null).blankedSentence).toBe('');
    expect(generateGrammarCloze('', '').matchFound).toBe(false);
  });

  it('strips placeholders correctly', () => {
    const result = generateGrammarCloze('Adj + 得很', '她跑得很快');
    expect(result.matchFound).toBe(true);
    expect(result.answers).toContain('得很');
  });
});
