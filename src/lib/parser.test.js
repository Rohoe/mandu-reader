import { describe, it, expect } from 'vitest';
import { parseReaderResponse, parseStorySegments, normalizeStructuredReader } from './parser';
import { zhReaderMarkdown, koReaderMarkdown, yueReaderMarkdown, malformedMarkdown, emptyResponse, structuredReaderJson } from '../test/fixtures/sampleReaderMarkdown';

// ── parseReaderResponse ──────────────────────────────────────

describe('parseReaderResponse', () => {
  describe('Chinese (zh)', () => {
    it('extracts title correctly', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.titleZh).toBe('小猫的冒险');
      expect(result.titleEn).toBe("The Kitten's Adventure");
    });

    it('extracts story text', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.story).toContain('**小猫**很喜欢在公园里玩');
      expect(result.story).toContain('别怕，我带你回家');
    });

    it('extracts vocabulary items with correct fields', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.vocabulary.length).toBeGreaterThanOrEqual(5);
      const xiaomao = result.vocabulary.find(v => v.target === '小猫');
      expect(xiaomao).toBeTruthy();
      expect(xiaomao.romanization).toBe('xiǎo māo');
      expect(xiaomao.translation).toContain('kitten');
      // Legacy aliases
      expect(xiaomao.chinese).toBe('小猫');
      expect(xiaomao.pinyin).toBeTruthy();
    });

    it('extracts comprehension questions', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.questions.length).toBeGreaterThanOrEqual(2);
      expect(result.questions[0].text).toContain('小猫每天早上做什么');
    });

    it('parses question with trailing translation', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      const q3 = result.questions.find(q => q.translation && q.translation.includes('Who helped'));
      expect(q3).toBeTruthy();
      expect(q3.text).toContain('谁帮助了小猫');
    });

    it('extracts anki JSON', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.ankiJson.length).toBeGreaterThanOrEqual(5);
      expect(result.ankiJson[0].chinese).toBe('小猫');
      expect(result.ankiJson[0].pinyin).toBe('xiǎo māo');
    });

    it('extracts grammar notes', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.grammarNotes.length).toBeGreaterThanOrEqual(2);
      const vdao = result.grammarNotes.find(n => n.pattern.includes('V + 到'));
      expect(vdao).toBeTruthy();
      expect(vdao.label).toContain('Directional complement');
      expect(vdao.example).toContain('跑到大树下面');
    });

    it('sets langId on result', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.langId).toBe('zh');
    });

    it('has no parse error', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      expect(result.parseError).toBeNull();
    });

    it('enriches vocab with usage notes from anki block', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      const pao = result.vocabulary.find(v => v.target === '跑');
      expect(pao).toBeTruthy();
      expect(pao.usageNoteStory).toBeTruthy();
    });

    it('extracts example sentences from vocab section', () => {
      const result = parseReaderResponse(zhReaderMarkdown, 'zh');
      const xiaomao = result.vocabulary.find(v => v.target === '小猫');
      expect(xiaomao.exampleStory).toBeTruthy();
      expect(xiaomao.exampleExtra).toBeTruthy();
    });
  });

  describe('Korean (ko)', () => {
    it('extracts Korean titles', () => {
      const result = parseReaderResponse(koReaderMarkdown, 'ko');
      expect(result.titleZh).toBe('고양이의 모험');
      expect(result.titleEn).toBe("The Cat's Adventure");
    });

    it('extracts Korean vocab with romanization field', () => {
      const result = parseReaderResponse(koReaderMarkdown, 'ko');
      expect(result.vocabulary.length).toBeGreaterThanOrEqual(2);
      const cat = result.vocabulary.find(v => v.target === '고양이');
      expect(cat).toBeTruthy();
      expect(cat.romanization).toBe('go-yang-i');
    });

    it('extracts Korean story', () => {
      const result = parseReaderResponse(koReaderMarkdown, 'ko');
      expect(result.story).toContain('**고양이**가 공원에서');
    });

    it('sets langId to ko', () => {
      const result = parseReaderResponse(koReaderMarkdown, 'ko');
      expect(result.langId).toBe('ko');
    });
  });

  describe('Cantonese (yue)', () => {
    it('extracts Cantonese titles', () => {
      const result = parseReaderResponse(yueReaderMarkdown, 'yue');
      expect(result.titleZh).toBe('貓仔嘅冒險');
      expect(result.titleEn).toBe("The Kitten's Adventure");
    });

    it('extracts Cantonese vocab with jyutping', () => {
      const result = parseReaderResponse(yueReaderMarkdown, 'yue');
      const cat = result.vocabulary.find(v => v.target === '貓仔');
      expect(cat).toBeTruthy();
      expect(cat.romanization).toBe('maau1 zai2');
    });
  });

  describe('Alternative heading formats (I8)', () => {
    it('parses headings without numbers (## Story, ## Vocabulary)', () => {
      const md = `## Title
小猫的冒险
The Kitten's Adventure

## Story
**小猫**很喜欢在公园里玩。每天早上，它都会跑到大树下面。它看到了蝴蝶很开心。

## Vocabulary
**小猫** (xiǎo māo) — kitten
- **小猫**很喜欢在公园里玩。
- *Main character.*
- 我家有一只**小猫**。
- *With measure word.*

## Questions
1. 小猫做什么？

## Anki Cards Data (JSON)
\`\`\`anki-json
[{"chinese": "小猫", "pinyin": "xiǎo māo", "english": "kitten", "example_story": "", "usage_note_story": "", "example_extra": "", "usage_note_extra": ""}]
\`\`\`

## Grammar Notes
**V + 到** (Directional complement) — Indicates arrival at a destination.
- 跑到大树下面。
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.titleZh).toBe('小猫的冒险');
      expect(result.titleEn).toBe("The Kitten's Adventure");
      expect(result.story).toContain('**小猫**很喜欢在公园里玩');
      expect(result.vocabulary.length).toBeGreaterThanOrEqual(1);
      expect(result.questions.length).toBe(1);
      expect(result.grammarNotes.length).toBe(1);
    });

    it('parses CJK section headings (## 故事, ## 词汇)', () => {
      const md = `## 标题
小猫的冒险
The Kitten's Adventure

## 故事
**小猫**很喜欢在公园里玩。它看到了蝴蝶很开心。

## 词汇
**小猫** (xiǎo māo) — kitten
- **小猫**很喜欢在公园里玩。
- *Main character.*

## 理解
1. 小猫做什么？

## Anki Cards Data (JSON)
\`\`\`anki-json
[{"chinese": "小猫", "pinyin": "xiǎo māo", "english": "kitten", "example_story": "", "usage_note_story": "", "example_extra": "", "usage_note_extra": ""}]
\`\`\`

## 语法
**V + 到** (Directional complement) — Indicates arrival.
- 跑到大树下面。
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.titleZh).toBe('小猫的冒险');
      expect(result.story).toContain('**小猫**很喜欢在公园里玩');
      expect(result.vocabulary.length).toBeGreaterThanOrEqual(1);
      expect(result.questions.length).toBe(1);
      expect(result.grammarNotes.length).toBe(1);
    });

    it('parses numbered vocab list format: 1. **word** (pinyin): definition', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。这只猫每天都跑步，非常开心地在公园里玩耍。

### 3. Vocabulary List
1. **猫** (māo): cat
2. **跑** (pǎo): to run

### 4. Comprehension Questions
1. 什么？

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[{"chinese": "猫", "pinyin": "māo", "english": "cat", "example_story": "", "usage_note_story": "", "example_extra": "", "usage_note_extra": ""}]
\`\`\`

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.vocabulary.length).toBeGreaterThanOrEqual(2);
      expect(result.vocabulary.find(v => v.target === '猫')).toBeTruthy();
      expect(result.vocabulary.find(v => v.target === '跑')).toBeTruthy();
    });

    it('parses grammar notes with colon separator', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。这只猫看到了蝴蝶然后跑到了公园里面去追它。

### 3. Vocabulary List

### 4. Comprehension Questions

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
**V + 到** (Directional complement): Indicates arrival at a destination.
- 跑到大树下面。
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.grammarNotes.length).toBe(1);
      expect(result.grammarNotes[0].pattern).toContain('V + 到');
    });

    it('returns parseWarnings when fallback title extraction is used', () => {
      const md = `# 小猫的故事

小猫很可爱。这是一个关于小猫的故事。小猫每天都在公园里玩耍。它看到了很多蝴蝶和花朵。小猫非常开心，因为公园里有很多有趣的东西。它跑啊跑，直到累了才停下来。后来一个小女孩帮助它回到了家里。小猫觉得很温暖。
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.parseWarnings.length).toBeGreaterThan(0);
    });

    it('handles empty sections without crashing', () => {
      const md = `### 1. Title

### 2. Story

### 3. Vocabulary List

### 4. Comprehension Questions

### 5. Anki Cards Data (JSON)

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.parseError).toBeNull();
      expect(result.vocabulary).toEqual([]);
      expect(result.questions).toEqual([]);
      expect(result.grammarNotes).toEqual([]);
    });

    it('handles response with only story content (no other sections)', () => {
      // 200+ Chinese characters to trigger block regex fallback
      const md = `小猫很喜欢在公园里玩。每天早上，它都会跑到大树下面。它看到了蝴蝶。小猫追蝴蝶追了很久。后来它累了，坐在树下休息。一个小女孩走过来，温柔地抱起了小猫，带它回家了。小猫觉得很幸福。这是一个快乐的故事。小猫从此以后每天都和小女孩一起在公园里玩耍。它们成了最好的朋友。公园里的花开得很美丽，蝴蝶飞来飞去。小猫再也不害怕了，因为有朋友在身边。这是一个关于友谊和勇气的温暖故事。每一天都充满了欢笑和快乐。小猫和小女孩的友谊越来越深厚。`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.parseError).toBeNull();
      // Story should be extracted via block regex fallback (200+ Chinese chars)
      expect(result.story.length).toBeGreaterThan(100);
    });

    it('handles malformed anki-json block gracefully', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。它在公园里面跑步。

### 3. Vocabulary List

### 4. Comprehension Questions

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
{ this is not valid json [[[
\`\`\`

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.ankiJson).toEqual([]);
      expect(result.parseError).toBeNull();
    });

    it('handles missing section numbers in headings', () => {
      const md = `### Title
小猫
Kitten

### Story
**小猫**在公园玩。它跑来跑去很开心。

### Vocabulary List
**小猫** (xiǎo māo) — kitten

### Comprehension Questions
1. 小猫在哪里？

### Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.titleZh).toBe('小猫');
      expect(result.story).toContain('**小猫**在公园玩');
      expect(result.vocabulary.length).toBe(1);
      expect(result.questions.length).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('returns parse error for empty input', () => {
      const result = parseReaderResponse(emptyResponse, 'zh');
      expect(result.parseError).toBe('Empty response from API.');
      expect(result.vocabulary).toEqual([]);
      expect(result.story).toBe('');
    });

    it('returns parse error for null input', () => {
      const result = parseReaderResponse(null, 'zh');
      expect(result.parseError).toBe('Empty response from API.');
    });

    it('handles malformed markdown gracefully', () => {
      const result = parseReaderResponse(malformedMarkdown, 'zh');
      // Should not throw
      expect(result.raw).toBe(malformedMarkdown);
      expect(result.parseError).toBeNull();
    });

    it('defaults langId to zh when not specified', () => {
      const result = parseReaderResponse(zhReaderMarkdown);
      expect(result.langId).toBe('zh');
    });

    it('synthesizes vocabulary from ankiJson when vocab section is empty', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**测试**的故事。

### 3. Vocabulary List

### 4. Comprehension Questions
1. 这是什么？

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[{"chinese": "测试", "pinyin": "cè shì", "english": "n. test", "example_story": "测试的故事。", "usage_note_story": "Basic.", "example_extra": "", "usage_note_extra": ""}]
\`\`\`

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      expect(result.vocabulary.length).toBe(1);
      expect(result.vocabulary[0].target).toBe('测试');
      expect(result.vocabulary[0].romanization).toBe('cè shì');
    });

    it('appends ankiJson words missing from vocab section', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**你好**世界。**再见**朋友。

### 3. Vocabulary List
**你好** (nǐ hǎo) — hello
- **你好**世界。
- *Basic greeting.*

### 4. Comprehension Questions
1. 什么？

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[
  {"chinese": "你好", "pinyin": "nǐ hǎo", "english": "hello", "example_story": "你好世界。", "usage_note_story": "Greeting.", "example_extra": "", "usage_note_extra": ""},
  {"chinese": "再见", "pinyin": "zài jiàn", "english": "goodbye", "example_story": "再见朋友。", "usage_note_story": "Farewell.", "example_extra": "", "usage_note_extra": ""}
]
\`\`\`

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      const targets = result.vocabulary.map(v => v.target);
      expect(targets).toContain('你好');
      expect(targets).toContain('再见');
    });

    it('deduplicates vocabulary items', () => {
      const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List
**猫** (māo) — cat
- **猫**很可爱。
- *A simple noun.*

**猫** (māo) — cat
- **猫**很可爱。
- *Duplicate entry.*

### 4. Comprehension Questions
1. 什么？

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[{"chinese": "猫", "pinyin": "māo", "english": "cat", "example_story": "猫很可爱。", "usage_note_story": "Simple noun.", "example_extra": "", "usage_note_extra": ""}]
\`\`\`

### 6. Grammar Notes
`;
      const result = parseReaderResponse(md, 'zh');
      const catEntries = result.vocabulary.filter(v => v.target === '猫');
      expect(catEntries.length).toBe(1);
    });
  });
});

// ── parseQuestions — MC/FR support ────────────────────────────

describe('parseQuestions — MC/FR support', () => {
  it('parses [MC] block with options and answer', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[MC] 猫喜欢什么？
A. 跑步
B. 睡觉
C. 吃饭
D. 游泳
Answer: B

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('mc');
    expect(result.questions[0].text).toBe('猫喜欢什么？');
    expect(result.questions[0].options).toEqual(['A. 跑步', 'B. 睡觉', 'C. 吃饭', 'D. 游泳']);
    expect(result.questions[0].correctAnswer).toBe('B');
  });

  it('parses [FR] line as free-response', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[FR] 你觉得猫为什么可爱？

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('fr');
    expect(result.questions[0].text).toBe('你觉得猫为什么可爱？');
  });

  it('parses mixed MC + FR in same section', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[MC] 猫在哪里？
A. 公园
B. 家里
C. 学校
D. 商店
Answer: A

[FR] 你觉得故事想表达什么？

[MC] 谁帮助了猫？
A. 小女孩
B. 小男孩
C. 老师
D. 妈妈
Answer: A

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(3);
    expect(result.questions[0].type).toBe('mc');
    expect(result.questions[0].correctAnswer).toBe('A');
    expect(result.questions[1].type).toBe('fr');
    expect(result.questions[2].type).toBe('mc');
    expect(result.questions[2].correctAnswer).toBe('A');
  });

  it('falls back to FR when MC block has missing options', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[MC] 猫喜欢什么？
A. 跑步
B. 睡觉

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('fr');
    expect(result.questions[0].text).toBe('猫喜欢什么？');
  });

  it('parses [TF] block with answer', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[TF] 猫很可爱。
Answer: T

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('tf');
    expect(result.questions[0].text).toBe('猫很可爱。');
    expect(result.questions[0].correctAnswer).toBe('T');
  });

  it('parses [TF] with answer F', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[TF] 猫不喜欢吃鱼。
Answer: F

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions[0].type).toBe('tf');
    expect(result.questions[0].correctAnswer).toBe('F');
  });

  it('malformed [TF] without answer falls back to FR', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[TF] 猫很可爱。

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions[0].type).toBe('fr');
  });

  it('parses [FB] block with answer and bank', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[FB] 小猫很喜欢在_____里玩。
Answer: 公园
Bank: 公园, 学校, 商店, 医院

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('fb');
    expect(result.questions[0].correctAnswer).toBe('公园');
    expect(result.questions[0].bank).toEqual(['公园', '学校', '商店', '医院']);
  });

  it('malformed [FB] without bank falls back to FR', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[FB] 小猫很喜欢在_____里玩。
Answer: 公园

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions[0].type).toBe('fr');
  });

  it('parses [VM] block with word-definition pairs', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[VM] Match the words with their definitions.
1. 猫 = cat
2. 狗 = dog
3. 鸟 = bird

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].type).toBe('vm');
    expect(result.questions[0].pairs).toEqual([
      { word: '猫', definition: 'cat' },
      { word: '狗', definition: 'dog' },
      { word: '鸟', definition: 'bird' },
    ]);
  });

  it('malformed [VM] with < 2 pairs falls back to FR', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[VM] Match the words.
1. 猫 = cat

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions[0].type).toBe('fr');
  });

  it('parses mixed MC + TF + FB + VM in same section', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
[MC] 猫在哪里？
A. 公园
B. 家里
C. 学校
D. 商店
Answer: A

[TF] 猫很可爱。
Answer: T

[FB] 小猫在_____里玩。
Answer: 公园
Bank: 公园, 学校, 商店, 医院

[VM] Match the words.
1. 猫 = cat
2. 狗 = dog

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(4);
    expect(result.questions[0].type).toBe('mc');
    expect(result.questions[1].type).toBe('tf');
    expect(result.questions[2].type).toBe('fb');
    expect(result.questions[3].type).toBe('vm');
  });

  it('legacy format (no tags) produces FR questions with type field', () => {
    const md = `### 1. Title
测试
Test

### 2. Story
**猫**很可爱。

### 3. Vocabulary List

### 4. Comprehension Questions
1. 小猫每天早上做什么？
2. 谁帮助了小猫？(Who helped the kitten?)

### 5. Anki Cards Data (JSON)
\`\`\`anki-json
[]
\`\`\`

### 6. Grammar Notes
`;
    const result = parseReaderResponse(md, 'zh');
    expect(result.questions.length).toBe(2);
    expect(result.questions[0].type).toBe('fr');
    expect(result.questions[0].text).toContain('小猫每天早上做什么');
    expect(result.questions[1].type).toBe('fr');
    expect(result.questions[1].translation).toContain('Who helped');
  });
});

// ── parseStorySegments ──────────────────────────────────────

describe('parseStorySegments', () => {
  it('returns empty array for empty input', () => {
    expect(parseStorySegments('')).toEqual([]);
    expect(parseStorySegments(null)).toEqual([]);
  });

  it('splits bold markers', () => {
    const segments = parseStorySegments('你好**世界**再见');
    expect(segments).toEqual([
      { type: 'text', content: '你好' },
      { type: 'bold', content: '世界' },
      { type: 'text', content: '再见' },
    ]);
  });

  it('splits italic markers', () => {
    const segments = parseStorySegments('你好*世界*再见');
    expect(segments).toEqual([
      { type: 'text', content: '你好' },
      { type: 'italic', content: '世界' },
      { type: 'text', content: '再见' },
    ]);
  });

  it('handles mixed bold and italic', () => {
    const segments = parseStorySegments('**bold** and *italic*');
    const types = segments.map(s => s.type);
    expect(types).toContain('bold');
    expect(types).toContain('italic');
    expect(types).toContain('text');
  });

  it('handles plain text without markers', () => {
    const segments = parseStorySegments('plain text only');
    expect(segments).toEqual([{ type: 'text', content: 'plain text only' }]);
  });
});

// ── normalizeStructuredReader ────────────────────────────────

describe('normalizeStructuredReader', () => {
  it('converts JSON object to parser shape', () => {
    const result = normalizeStructuredReader(structuredReaderJson, 'zh');
    expect(result.titleZh).toBe('小猫的冒险');
    expect(result.titleEn).toBe("The Kitten's Adventure");
    expect(result.story).toContain('**小猫**');
    expect(result.vocabulary.length).toBe(2);
    expect(result.vocabulary[0].target).toBe('小猫');
    expect(result.vocabulary[0].translation).toBe('n. kitten');
    expect(result.questions.length).toBe(2);
    expect(result.grammarNotes.length).toBe(1);
    expect(result.parseError).toBeNull();
    expect(result.langId).toBe('zh');
  });

  it('converts JSON string to parser shape', () => {
    const result = normalizeStructuredReader(JSON.stringify(structuredReaderJson), 'zh');
    expect(result.titleZh).toBe('小猫的冒险');
    expect(result.vocabulary.length).toBe(2);
  });

  it('falls back to regex parser on invalid JSON string', () => {
    const result = normalizeStructuredReader(zhReaderMarkdown, 'zh');
    // Should fallback to parseReaderResponse and still extract content
    expect(result.titleZh).toBeTruthy();
    expect(result.story).toBeTruthy();
  });

  it('populates ankiJson from vocabulary', () => {
    const result = normalizeStructuredReader(structuredReaderJson, 'zh');
    expect(result.ankiJson.length).toBe(2);
    expect(result.ankiJson[0].chinese).toBe('小猫');
    expect(result.ankiJson[0].pinyin).toBe('xiǎo māo');
  });

  it('sets raw field correctly', () => {
    const result = normalizeStructuredReader(structuredReaderJson, 'zh');
    expect(result.raw).toBeTruthy();
    const parsed = JSON.parse(result.raw);
    expect(parsed.title_target).toBe('小猫的冒险');
  });

  it('handles empty vocabulary and questions', () => {
    const result = normalizeStructuredReader({ title_target: 'Test', title_en: 'Test', story: 'Story' }, 'zh');
    expect(result.vocabulary).toEqual([]);
    expect(result.questions).toEqual([]);
    expect(result.grammarNotes).toEqual([]);
  });

  it('defaults langId to zh', () => {
    const result = normalizeStructuredReader(structuredReaderJson);
    expect(result.langId).toBe('zh');
  });
});
