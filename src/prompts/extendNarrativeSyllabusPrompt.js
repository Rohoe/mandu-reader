export function buildExtendNarrativeSyllabusPrompt(langConfig, syllabus, additionalCount, nativeLangName = 'English') {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;
  const { narrativeArc, futureArc, lessons, topic, narrativeType } = syllabus;

  const lastLesson = lessons[lessons.length - 1];
  const startNumber = lessons.length + 1;
  const endNumber = lessons.length + additionalCount;

  const roleExtra = narrativeType === 'historical' ? 'historian' : 'literary scholar';

  // Narrative arc context
  const arcSection = narrativeArc
    ? `## Narrative Arc\nOverview: ${narrativeArc.overview || ''}\nCharacters: ${(narrativeArc.characters || []).map(c => `${c.name} (${c.role})`).join(', ')}\nSettings: ${(narrativeArc.settings || []).join(', ')}`
    : '';

  // Last lesson continuity
  const continuitySection = lastLesson
    ? `## Last Chapter\nTitle: ${lastLesson.title_en || ''}\nSummary: ${lastLesson.chapter_summary || ''}\nContinuity notes: ${lastLesson.continuity_notes || ''}`
    : '';

  // Future arc roadmap (if available)
  const roadmapSection = futureArc?.segments?.length > 0
    ? `## Pre-Planned Roadmap\nThe following segments were planned during initial syllabus creation. Detail these into full lesson objects:\n${futureArc.segments.slice(0, Math.ceil(additionalCount / 5)).map(s => `- Lessons ${s.start_lesson}–${s.end_lesson} (${s.arc_phase}): ${s.summary}`).join('\n')}\n\nFollow this roadmap closely. Do not deviate from the planned arc.`
    : `## Continuation\nNo pre-planned roadmap exists. Continue the narrative naturally from where the last chapter ended, maintaining consistency with the established arc.`;

  return `You are a ${p.curriculumDesigner}, storyteller, and ${roleExtra} extending an existing narrative graded reader syllabus.

Topic: ${topic}
${profName} Level: ${syllabus.level}
Number of new lessons: ${additionalCount}

${arcSection}

${continuitySection}

${roadmapSection}

Generate ${additionalCount} NEW lessons numbered ${startNumber}–${endNumber}. Each new lesson must:
- Continue the narrative arc naturally from the previous chapter
- Maintain all established characters, settings, and plot threads
- Include continuity_notes for cross-chapter accuracy

Return ONLY a JSON array of new lesson objects (no wrapper object, no explanation, no markdown fences):
[
  {
    "lesson_number": ${startNumber},
    "${p.titleFieldKey}": "${p.titleInstruction}",
    "title_en": "${nativeLangName} lesson title",
    "description": "one ${nativeLangName} sentence",
    "vocabulary_focus": ["3-5 keywords"],
    "difficulty_hint": "review|core|stretch",
    "chapter_summary": "2-3 sentences in ${nativeLangName}",
    "characters": ["character names featured"],
    "setting": "where/when",
    "narrative_position": "setup|rising|climax|falling|resolution",
    "continuity_notes": "key facts to carry forward"
  }
]`;
}
