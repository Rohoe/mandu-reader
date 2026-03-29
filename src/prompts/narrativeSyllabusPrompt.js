export function buildNarrativeSyllabusPrompt(langConfig, sourceMaterial, narrativeType, level, lessonCount, nativeLangName = 'English', { learnerProfile } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;

  const roleExtra = narrativeType === 'historical' ? 'historian' : 'literary scholar';

  const sourceLines = [`Title: ${sourceMaterial.title}`];
  if (sourceMaterial.author) sourceLines.push(`Author: ${sourceMaterial.author}`);
  if (sourceMaterial.period) sourceLines.push(`Period: ${sourceMaterial.period}`);
  if (sourceMaterial.description) sourceLines.push(`Description: ${sourceMaterial.description}`);

  const narrativeInstruction = narrativeType === 'historical'
    ? `Plan a historically accurate narrative arc about ${sourceMaterial.title}. Verify dates, historical figures, and events against established historical record.
- Each lesson should center on a specific event, decision, confrontation, or turning point — not a vague time period.
- Name specific historical figures as protagonists of each lesson. History is made by people, not abstractions.
- Hook the reader early: Lesson 1 should open with a vivid scene or pivotal moment, providing context as needed within the narrative.
- Present history as an engaging narrative, not a textbook.`
    : `Plan an abridged retelling of ${sourceMaterial.title} faithful to the source material.
- Identify the work's most famous, dramatic, or widely-anthologized passages. Build lessons around these highlights rather than marching linearly through sections.
- For multi-section or encyclopedic works (histories with annals and biographies, essay collections, story cycles): interleave 1-2 framework lessons that establish scope with focused deep-dives into standout episodes from different sections.
- For single-narrative works (novels, epics): follow the narrative arc but center lessons on pivotal scenes — moments of crisis, confrontation, reversal, or revelation.
- Hook the reader early: Lesson 1 should feature a vivid, dramatic scene or a compelling character — not abstract background or mythological preamble.
- Simplify language to match the target proficiency level while maintaining the essence of the original.`;

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

## Future Arc Quality
If returning a \`future_arc\`:
- Plan 3-5 segments. Each segment is a thematic mini-arc spanning 4-8 lessons, not an individual lesson.
- Each segment must name 3-4 specific stories, chapters, figures, or events — never vague summaries like "more biographies" or "later developments."
- For multi-section or encyclopedic works, organize segments thematically (e.g., "stories of loyalty and sacrifice," "strategists and philosophers") rather than by source-text page order.
- Each segment summary should read like a compelling teaser that makes the learner want to continue.

## Continuity
For each lesson, include \`continuity_notes\` with: (1) key historical facts, dates, plot points, or source-material references that must be accurately maintained, (2) thematic threads and literary parallels connecting this lesson to others, and (3) any deliberate simplifications made for the target level.
${learnerSection}
Return a JSON object with the following structure:
{
  "narrative_arc": {
    "overview": "3-5 sentence overview of the complete arc, highlighting the work's central tensions and why it endures (in ${nativeLangName})",
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
      "vocabulary_focus": ["3-5 keywords drawn from this specific lesson's content, not generic topic labels"],
      "difficulty_hint": "review|core|stretch",
      "chapter_summary": "2-3 sentences describing the dramatic action or turning point of this chapter — what characters DO, not what period this covers (in ${nativeLangName})",
      "characters": ["character names featured"],
      "setting": "where/when this chapter takes place",
      "narrative_position": "setup|rising|climax|falling|resolution — assign based on dramatic tension, not chronological position",
      "continuity_notes": "key facts, dates, plot threads, thematic parallels that must carry forward"
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
