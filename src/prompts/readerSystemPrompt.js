export function buildReaderSystem(langConfig, level, topic, charRange, targetChars = 1200, nativeLangName = 'English', { difficultyHint, recentTopics } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;

  // Scale content expectations based on reader length
  const vocabRange = targetChars <= 250 ? '3-5'
    : targetChars <= 500 ? '6-9'
    : targetChars <= 1000 ? '10-14'
    : targetChars <= 1500 ? '14-18'
    : '16-22';
  const questionRange = targetChars <= 250 ? '3-4' : '5-6';
  const grammarRange = targetChars <= 250 ? '1-2' : '3-5';
  const minAppearances = 1;

  // Scale comprehension question difficulty by proficiency level
  const questionDifficulty = level <= 2
    ? `Questions should test basic comprehension: direct factual recall from the story, simple true/false statements, and vocabulary recognition. Answers should be clearly and explicitly stated in the text.`
    : level <= 4
    ? `Questions should mix factual recall with some inferential thinking: include 1-2 questions that require the reader to combine information from different parts of the story, understand cause-and-effect, or infer a character's motivation. Not every answer should be a word-for-word quote from the text.`
    : `Questions should emphasize higher-order thinking: inference, synthesis, and interpretation. Most questions should require the reader to read between the lines — e.g. infer unstated motivations, draw conclusions from context, evaluate a character's decision, or identify the theme/message. Avoid questions where the answer is a verbatim phrase from the text. At most 1 question should be simple factual recall.`;

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
- Length: ${charRange} ${langConfig.charUnit}
- Topic: ${topic}
${p.getStoryRequirements(level)}
- Where natural, reuse previously-learned vocabulary to reinforce retention
- If a "Learner Adaptation Context" section is provided, use it to guide vocabulary selection: reinforce words the learner struggles with, and prefer grammar patterns the learner has not yet mastered${difficultyHint === 'review' ? '\n- Use simpler grammar and shorter sentences, reviewing fundamentals' : ''}${difficultyHint === 'stretch' ? '\n- Introduce a few patterns from the next level up as preview' : ''}

## OUTPUT FORMAT

IMPORTANT: Use EXACTLY these English section headings (do not translate them):

### 1. Title
${p.targetLanguage} text only (no bold markers, no ${nativeLangName}, no ${profName} level suffix)
${nativeLangName} subtitle on the next line

### 2. Story
With bolded vocabulary and italicized proper nouns

### 3. Vocabulary
Return a JSON block tagged \`\`\`vocab-json containing an array of vocabulary objects.
Each object includes: the word fields, a story example sentence (copied exactly from the story, without bold markers), a one-sentence usage note, an extra example sentence, and its usage note.
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
${questionDifficulty}

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
Identify ${grammarRange} key ${p.grammarContext} used in the story. For each pattern:
- **Pattern** (${nativeLangName} name) — one-sentence explanation of the structure and when to use it
- Example sentence taken directly from the story

### 6. Suggested Topics
2-3 follow-up topic ideas (in ${nativeLangName}), one per line. Suggest topics that complement this story.${recentTopics?.length > 0 ? `\n(The learner has recently studied: ${recentTopics.join(', ')} — suggest different ones.)` : ''}`;
}
