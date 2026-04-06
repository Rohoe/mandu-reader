export function buildReaderSystem(langConfig, level, topic, charRange, targetChars = 1200, nativeLangName = 'English', { difficultyHint, recentTopics, useTargetLang } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;
  const descLang = useTargetLang ? p.targetLanguage : nativeLangName;

  // Scale content expectations based on reader length
  const vocabRange = targetChars <= 250 ? '3-5'
    : targetChars <= 500 ? '6-9'
    : targetChars <= 1000 ? '10-14'
    : targetChars <= 1500 ? '14-18'
    : '16-22';
  const questionRange = targetChars <= 250 ? '3-4' : '5-6';
  const grammarRange = targetChars <= 250 ? '1-2' : '3-5';
  const minAppearances = 1;

  return `Create an educational graded reader in ${p.targetLanguage} for ${profName} ${level} learners.

CRITICAL: Follow the exact section format below. Never omit sections or change heading numbering.

## VOCABULARY REQUIREMENTS
- Select ${vocabRange} new vocabulary items appropriate for the specified ${profName} level
- Items may include single words, compound words, collocations, or idiomatic expressions
- Vocabulary should have high utility for the target proficiency band
- Each new item must appear at least once in the story; aim to use most items 2+ times where it feels natural
- Bold all instances of new vocabulary: **새단어**
- Only bold words that are in the vocabulary list — do not bold other words

## STORY REQUIREMENTS
- Length: ${charRange} ${langConfig.charUnit}. IMPORTANT: the story MUST reach this target length. Do not wrap up the narrative prematurely — if the plot resolves early, develop additional scenes, dialogue, or descriptive detail. A story under ${targetChars - (targetChars <= 300 ? 50 : 100)} ${langConfig.charUnitShort} is too short.
- Topic: ${topic}
${p.getStoryRequirements(level)}
- Where natural, reuse previously-learned vocabulary to reinforce retention
- If a "Learner Adaptation Context" section is provided:
  - Reinforce words the learner struggles with by weaving them into the story naturally
  - Prioritize teaching grammar patterns the learner has not yet mastered in the Grammar Notes section
  - If the learner's trajectory is "accelerating," introduce slightly more ambitious vocabulary; if "decelerating," emphasize review and familiar patterns${difficultyHint === 'review' ? '\n- Use simpler grammar and shorter sentences, reviewing fundamentals' : ''}${difficultyHint === 'stretch' ? '\n- Introduce a few patterns from the next level up as preview' : ''}

## STORY STYLE
- Write an engaging story, not a textbook exercise. Create a scenario with characters who want something, face an obstacle, and resolve it.
- Vary your pacing — mix dialogue, action, and description. Not every paragraph should read the same way.
- Ground scenes in specific, vivid details rather than generic settings.

## OUTPUT FORMAT

IMPORTANT: Use EXACTLY these English section headings (do not translate them):

### 1. Title
${p.targetLanguage} text only (no bold markers, no ${nativeLangName}, no ${profName} level suffix)
${nativeLangName} subtitle on the next line

### 2. Story
With bolded vocabulary and italicized proper nouns

### 3. Vocabulary
Return a JSON block tagged \`\`\`vocab-json containing an array of vocabulary objects.
Each object includes: the word fields, a story example sentence (copied exactly from the story, without bold markers), a one-sentence usage note (in ${descLang}), an extra example sentence, and its usage note (in ${descLang}).
Do NOT prefix example sentences with labels like "Example:" — just write the sentence directly.
\`\`\`vocab-json
[
  ${p.vocabJsonFields}
]
\`\`\`

### 4. Comprehension Questions
${questionRange} questions in ${p.targetLanguage} at the target level.
Default mix: ~2 multiple-choice, 1 true/false, 1 fill-in-the-blank, 1 vocabulary matching.
All questions are auto-graded — do NOT use free-response.

For multiple-choice questions, use EXACTLY this format:
[MC] Question text?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B

For true/false questions, use EXACTLY this format:
[TF] Statement about the story.
Answer: T

For fill-in-the-blank questions (use a vocabulary word from the story), use EXACTLY this format:
[FB] Sentence with _____ in it.
Answer: word
Bank: word, distractor1, distractor2, distractor3

For vocabulary matching questions (use 3-5 vocabulary words from the story), use EXACTLY this format:
[VM] Match the words with their definitions.
1. word1 = definition1
2. word2 = definition2
3. word3 = definition3

### 5. Grammar Notes
Return a JSON block tagged \`\`\`grammar-json containing an array of ${grammarRange} grammar pattern objects.
Focus on sentence-level structures and constructions — not individual vocabulary words or adverbs.
If a word is already in the vocabulary list, do not repeat it as a grammar note.
\`\`\`grammar-json
[
  { "pattern": "看似…实则…", "label": "对比句式", "explanation": "表达表面与实际的对比", "example": "..." },
  { "pattern": "由…V着", "label": "表示执行者", "explanation": "说明动作由谁完成", "example": "..." }
]
\`\`\`
- "pattern": the bare grammatical structure only (e.g. "看似…实则…", "一…就…", "把…V成…"). Never include descriptions in this field.
- "label": short ${descLang} name for what the pattern does
- "explanation": one-sentence ${descLang} explanation of when/how to use it
- "example": example sentence taken directly from the story

### 6. Suggested Topics
2-3 follow-up topic ideas (in ${useTargetLang ? p.targetLanguage : nativeLangName}), one per line. Suggest topics that complement this story.${recentTopics?.length > 0 ? `\n(The learner has recently studied: ${recentTopics.join(', ')} — suggest different ones.)` : ''}`;
}
