export function buildExtendSyllabusPrompt(langConfig, topic, level, existingLessons, additionalCount, nativeLangName = 'English', { useTargetLang } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;
  const descLang = useTargetLang ? p.targetLanguage : nativeLangName;

  const existingTitles = existingLessons
    .map((l, i) => `${i + 1}. ${l.title_en} (${l[p.titleFieldKey] || l.title_zh || l.title_target || ''})`)
    .join('\n');

  const startNumber = existingLessons.length + 1;
  const endNumber = existingLessons.length + additionalCount;

  return `You are a ${p.curriculumDesigner} extending an existing graded reader syllabus.

Topic: ${topic}
${profName} Level: ${level}
Number of new lessons to add: ${additionalCount}

Existing lessons (do NOT repeat these):
${existingTitles}

Generate ${additionalCount} NEW lessons that continue the curriculum, numbered ${startNumber}–${endNumber}.
Each new lesson should build on the existing ones and introduce new aspects of the topic.

Return ONLY a JSON array of the new lesson objects (no wrapper object, no explanation, no markdown fences):
[
  {
    "lesson_number": ${startNumber},
    "${p.titleFieldKey}": "${p.titleInstruction}",
    "title_en": "${nativeLangName} lesson title",
    "description": "One ${descLang} sentence describing what the reader covers",
    "vocabulary_focus": ["3-5 ${descLang} keywords describing the vocabulary theme"]
  }
]`;
}
