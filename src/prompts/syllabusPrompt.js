export function buildSyllabusPrompt(langConfig, topic, level, lessonCount, nativeLangName = 'English') {
  const p = langConfig.prompts;
  return `You are a ${p.curriculumDesigner}. Generate a graded reader syllabus for the following parameters:

Topic: ${topic}
${langConfig.proficiency.name} Level: ${level}
Number of lessons: ${lessonCount}

Return a JSON object with exactly two keys:
- "summary": A 2-3 sentence overview (in ${nativeLangName}) of what the learner will cover across all lessons
- "lessons": an array of lesson objects, each with:
  - "lesson_number": integer (1-${lessonCount})
  - "${p.titleFieldKey}": ${p.titleInstruction}
  - "title_en": ${nativeLangName} lesson title
  - "description": One ${nativeLangName} sentence describing what the reader covers
  - "vocabulary_focus": 3-5 ${nativeLangName} keywords describing the vocabulary theme
  - "difficulty_hint": one of "review", "core", or "stretch" — indicating relative difficulty within the level. Early lessons should use "review" to ease in, most lessons use "core", and a few later lessons use "stretch" to preview the next level

Return ONLY valid JSON. No explanation, no markdown fences.`;
}
