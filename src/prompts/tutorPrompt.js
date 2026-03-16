/**
 * Builds the system prompt for the AI tutor chat.
 * Injects lesson context so the tutor can reference the story, vocabulary, etc.
 */

export function buildTutorSystemPrompt(reader, lessonMeta, langConfig, nativeLangName) {
  const level = reader?.level ?? lessonMeta?.level ?? 3;
  const profName = langConfig.proficiency.name;
  const targetLang = langConfig.prompts.targetLanguage;

  const parts = [];

  // 1. Role
  parts.push(`You are a patient, encouraging language tutor for ${targetLang} at ${profName} level ${level}.`);
  parts.push(`The student's native language is ${nativeLangName}. Use ${nativeLangName} for explanations and definitions. Default to ${targetLang} for practice and conversation. Correct errors gently and encourage vocabulary usage.`);
  parts.push(`Keep responses concise — 2-4 sentences for simple questions, longer for explanations or quizzes. Use markdown formatting for vocabulary and grammar patterns.`);

  // 2. Story text
  if (reader?.story) {
    const story = reader.story.length > 1500
      ? reader.story.slice(0, 800) + '\n[...]\n' + reader.story.slice(-600)
      : reader.story;
    parts.push(`\n## Lesson Story\n${story}`);
  }

  // 3. Vocabulary
  if (reader?.vocabulary?.length > 0) {
    const vocabLines = reader.vocabulary.slice(0, 20).map(v => {
      const rom = v.romanization ? ` (${v.romanization})` : '';
      return `- **${v.target}**${rom} — ${v.english}`;
    });
    parts.push(`\n## Vocabulary\n${vocabLines.join('\n')}`);
  }

  // 4. Grammar notes
  if (reader?.grammarNotes?.length > 0) {
    const grammarLines = reader.grammarNotes.map(g =>
      `- **${g.pattern}** (${g.label}) — ${g.explanation}. Example: ${g.example}`
    );
    parts.push(`\n## Grammar Notes\n${grammarLines.join('\n')}`);
  }

  // 5. Quiz performance
  if (reader?.quizResults) {
    let quizSection = `\n## Student Quiz Performance\nScore: ${reader.quizResults.score ?? 'N/A'}`;
    if (reader.quizResults.results) {
      for (const r of reader.quizResults.results) {
        const status = r.correct ? 'correct' : 'incorrect';
        quizSection += `\n- ${r.question}: ${status}${r.feedback ? ` — ${r.feedback}` : ''}`;
      }
    }
    parts.push(quizSection);
  }

  // 6. Syllabus context
  if (lessonMeta) {
    const metaParts = [];
    if (lessonMeta.description) metaParts.push(`Lesson: ${lessonMeta.description}`);
    if (lessonMeta.vocabulary_focus?.length > 0) metaParts.push(`Focus areas: ${lessonMeta.vocabulary_focus.join(', ')}`);
    if (lessonMeta.difficulty_hint) metaParts.push(`Difficulty: ${lessonMeta.difficulty_hint}`);
    if (metaParts.length > 0) {
      parts.push(`\n## Lesson Context\n${metaParts.join('\n')}`);
    }
  }

  return parts.join('\n');
}
