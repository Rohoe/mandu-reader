export function buildNarrativeSyllabusPrompt(langConfig, sourceMaterial, narrativeType, level, lessonCount, nativeLangName = 'English', { learnerProfile } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;

  const roleExtra = narrativeType === 'historical' ? 'historian' : 'literary scholar';

  const sourceLines = [`Title: ${sourceMaterial.title}`];
  if (sourceMaterial.author) sourceLines.push(`Author: ${sourceMaterial.author}`);
  if (sourceMaterial.period) sourceLines.push(`Period: ${sourceMaterial.period}`);
  if (sourceMaterial.description) sourceLines.push(`Description: ${sourceMaterial.description}`);

  const narrativeInstruction = narrativeType === 'historical'
    ? `Plan a historically accurate chronological arc about ${sourceMaterial.title}. Each lesson covers a distinct period, event, or theme. Verify dates, historical figures, and events against established historical record. Present history as an engaging narrative, not a textbook.`
    : `Plan an abridged retelling of ${sourceMaterial.title} faithful to the source material. Each lesson covers a distinct section or chapter group of the work. Preserve key plot points, character arcs, and themes. Simplify language to match the target proficiency level while maintaining the essence of the original.`;

  const learnerSection = learnerProfile
    ? `\n## Learner Profile\nThe student has prior experience. Adapt the syllabus — skip mastered concepts, build on existing knowledge.\n${learnerProfile}\n`
    : '';

  return `You are a ${p.curriculumDesigner}, storyteller, and ${roleExtra}. Generate a narrative arc graded reader syllabus for the following parameters:

## Source Material
${sourceLines.join('\n')}

${profName} Level: ${level}
Number of lessons to detail: ${lessonCount}

## Narrative Instructions
${narrativeInstruction}

## Segmentation
First, estimate how many lessons the complete arc requires. If it exceeds ${lessonCount}, plan the FULL arc scope but only detail the first ${lessonCount} lessons. Return a \`future_arc\` object outlining the remaining segments so the course can be extended later. If the arc fits within ${lessonCount}, omit the \`future_arc\` field.

## Continuity
For each lesson, include \`continuity_notes\` with key historical facts, dates, plot points, or source-material references that must be accurately maintained across lessons. Flag any deliberate simplifications in the lesson description.
${learnerSection}
Return a JSON object with the following structure:
{
  "narrative_arc": {
    "overview": "3-5 sentence overview of the complete arc (in ${nativeLangName})",
    "total_planned_lessons": number,
    "characters": [{ "name": "target language name", "role": "brief role description in ${nativeLangName}", "introduced_in": lesson_number }],
    "settings": ["key locations or time periods"]
  },
  "lessons": [
    {
      "lesson_number": integer (1-${lessonCount}),
      "${p.titleFieldKey}": ${p.titleInstruction},
      "title_en": "${nativeLangName} lesson title",
      "description": "one sentence in ${nativeLangName}",
      "vocabulary_focus": ["3-5 keywords"],
      "difficulty_hint": "review|core|stretch",
      "chapter_summary": "2-3 sentences describing what happens in this chapter (in ${nativeLangName})",
      "characters": ["character names featured"],
      "setting": "where/when this chapter takes place",
      "narrative_position": "setup|rising|climax|falling|resolution",
      "continuity_notes": "key facts, dates, plot threads that must carry forward"
    }
  ],
  "future_arc": {
    "summary": "overview of what remains",
    "segments": [{ "start_lesson": N, "end_lesson": M, "arc_phase": "rising|climax|falling|resolution", "summary": "what this segment covers" }]
  },
  "suggested_topics": ["2-3 related narrative ideas in ${nativeLangName}"]
}

Return ONLY valid JSON. No explanation, no markdown fences.`;
}
