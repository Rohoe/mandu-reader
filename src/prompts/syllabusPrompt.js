export function buildSyllabusPrompt(langConfig, topic, level, lessonCount, nativeLangName = 'English', { learnerProfile, recentTopics, useTargetLang } = {}) {
  const p = langConfig.prompts;
  // When useTargetLang is true, descriptive fields are written in the target language
  const descLang = useTargetLang ? p.targetLanguage : nativeLangName;
  const learnerSection = learnerProfile
    ? `\n## Learner Profile\nThe student has prior experience. Adapt the syllabus — skip mastered concepts, build on existing knowledge.\n${learnerProfile}\n`
    : '';
  const recentSection = recentTopics?.length > 0
    ? `\nThe learner has recently studied these topics (suggest different ones):\n${recentTopics.map(t => `- ${t}`).join('\n')}\n`
    : '';
  return `You are a ${p.curriculumDesigner}. Generate a graded reader syllabus for the following parameters:

Topic: ${topic}
${langConfig.proficiency.name} Level: ${level}
Number of lessons: ${lessonCount}
${learnerSection}${recentSection}
Return a JSON object with exactly three keys:
- "summary": A 2-3 sentence overview (in ${descLang}) of what the learner will cover across all lessons
- "lessons": an array of lesson objects, each with:
  - "lesson_number": integer (1-${lessonCount})
  - "${p.titleFieldKey}": ${p.titleInstruction}
  - "title_en": ${nativeLangName} lesson title
  - "description": One ${descLang} sentence describing what the reader covers
  - "vocabulary_focus": 3-5 ${descLang} keywords describing the vocabulary theme
  - "difficulty_hint": one of "review", "core", or "stretch" — indicating relative difficulty within the level. Early lessons should use "review" to ease in, most lessons use "core", and a few later lessons use "stretch" to preview the next level
- "suggested_topics": 2-3 follow-up topic ideas (short phrases in ${descLang}) that build on or complement this syllabus

Return ONLY valid JSON. No explanation, no markdown fences.`;
}
