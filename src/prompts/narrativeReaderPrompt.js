export function buildNarrativeReaderSystem(langConfig, level, topic, charRange, targetChars = 1200, nativeLangName = 'English', { difficultyHint, narrativeType } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;

  const vocabRange = targetChars <= 250 ? '3-5'
    : targetChars <= 500 ? '6-9'
    : targetChars <= 1000 ? '10-14'
    : targetChars <= 1500 ? '14-18'
    : '16-22';
  const questionRange = targetChars <= 250 ? '3-4' : '5-6';
  const grammarRange = targetChars <= 250 ? '1-2' : '3-5';

  const accuracySection = (narrativeType === 'historical' || narrativeType === 'book')
    ? `\n### 7. Accuracy Notes
Return a JSON block tagged \`\`\`accuracy-json containing an array of accuracy note objects.
Each object: { "claim": "the factual claim made in the story", "status": "accurate|simplified|creative_liberty", "note": "explanation in ${nativeLangName}" }
Include 2-5 notes covering the most significant historical facts or source material references in this chapter.\n`
    : '';

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
- NARRATIVE CONTINUITY: This is a chapter in a serialized narrative. You MUST maintain character names, relationships, personality traits, and plot threads exactly as established in the narrative context provided. Do not introduce contradictions with prior chapters.
- If narrative context is provided below, continue the story naturally from where the previous chapter left off.

## NARRATIVE STYLE${narrativeType === 'book' ? `
- Capture the source material's distinctive literary voice and techniques. Write as an adaptation that honors the original's style, not a generic retelling.` : ''}${narrativeType === 'historical' ? `
- Present history through character-driven drama. Show people making decisions under pressure, not abstract forces moving through time.` : ''}
- Vary your pacing within the chapter — mix dialogue, action, and reflection. Not every paragraph should read the same way.
- Create vivid sensory detail for settings. Ground the reader in a specific time and place.
- Let characters reveal themselves through their words and actions, not exposition.

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
2-3 follow-up topic ideas (in ${nativeLangName}), one per line. Suggest topics that complement this story.
${accuracySection}
### ${accuracySection ? '8' : '7'}. Story So Far
Write a concise 3-5 sentence summary of the complete story up to and including this chapter. This will be used as context for generating the next chapter. Include key plot developments, character status, and any unresolved threads.
Also note any significant character developments on a separate line starting with 'Character updates:'`;
}

export function buildNarrativeContext(syllabus, generatedReaders, currentIdx) {
  const totalLessons = syllabus.lessons.length;
  const lines = [];

  // Header
  lines.push(`This is chapter ${currentIdx + 1} of ${totalLessons} in a narrative course: "${syllabus.topic}"`);

  // Character registry
  const characters = syllabus.narrativeArc?.characters;
  if (characters?.length) {
    lines.push('');
    lines.push('Characters: ' + characters.map(c => `${c.name} (${c.role})`).join(', '));
  }

  // Tiered context from prior lessons
  if (currentIdx > 0) {
    const deepStart = Math.max(0, currentIdx - 2);
    const mediumStart = Math.max(0, currentIdx - 6);
    const compressedEnd = mediumStart;

    // Compressed tier (oldest)
    if (compressedEnd > 0) {
      lines.push('');
      lines.push('## Earlier chapters (compressed)');
      let foundSummary = false;
      for (let i = compressedEnd - 1; i >= 0; i--) {
        const readerKey = `lesson_${syllabus.id}_${i}`;
        const reader = generatedReaders[readerKey];
        if (reader?.narrativeState?.runningSummary) {
          lines.push(reader.narrativeState.runningSummary);
          foundSummary = true;
          break;
        }
      }
      if (!foundSummary) {
        for (let i = 0; i < compressedEnd; i++) {
          const lesson = syllabus.lessons[i];
          if (lesson?.chapter_summary) {
            lines.push(`- Ch${i + 1}: ${lesson.chapter_summary}`);
          }
        }
      }
    }

    // Medium tier
    if (mediumStart < deepStart) {
      lines.push('');
      lines.push('## Recent chapters (summary)');
      for (let i = mediumStart; i < deepStart; i++) {
        const lesson = syllabus.lessons[i];
        if (lesson?.chapter_summary) {
          lines.push(`- Ch${i + 1}: ${lesson.chapter_summary}`);
        }
      }
    }

    // Deep tier (most recent 1-2 chapters)
    lines.push('');
    lines.push('## Previous chapters (detailed)');
    for (let i = deepStart; i < currentIdx; i++) {
      const lesson = syllabus.lessons[i];
      const readerKey = `lesson_${syllabus.id}_${i}`;
      const reader = generatedReaders[readerKey];

      lines.push(`\nChapter ${i + 1}: ${lesson?.title_en || lesson?.title || ''}`);
      if (lesson?.chapter_summary) lines.push(`Summary: ${lesson.chapter_summary}`);
      if (lesson?.continuity_notes) lines.push(`Continuity: ${lesson.continuity_notes}`);
      if (reader?.narrativeState?.characterUpdates) {
        lines.push(`Character updates: ${reader.narrativeState.characterUpdates}`);
      }
    }
  }

  // Current lesson plan
  const current = syllabus.lessons[currentIdx];
  if (current) {
    lines.push('');
    lines.push('## Current chapter plan');
    if (current.chapter_summary) lines.push(`Current chapter plan: ${current.chapter_summary}`);
    if (current.setting) lines.push(`Setting: ${current.setting}`);
    if (current.characters?.length) lines.push(`Featured characters: ${current.characters.join(', ')}`);
    if (current.narrative_position) {
      lines.push(`Narrative position: ${current.narrative_position}`);
      const pacingGuide = {
        setup: 'Pacing: Establish the world and characters with vivid detail. Build curiosity.',
        rising: 'Pacing: Escalate stakes and tension. Deepen conflicts.',
        climax: 'Pacing: Maximum dramatic intensity. The pivotal confrontation or turning point.',
        falling: 'Pacing: Show consequences unfolding. Characters reckon with what happened.',
        resolution: 'Pacing: Bring closure. Reflect on what the journey meant.',
      };
      if (pacingGuide[current.narrative_position]) lines.push(pacingGuide[current.narrative_position]);
    }
    if (current.continuity_notes) lines.push(`Key facts to maintain: ${current.continuity_notes}`);
  }

  // Final instruction
  lines.push('');
  lines.push('Build upon the established narrative. Maintain consistency with all prior chapters.');

  return lines.join('\n');
}
