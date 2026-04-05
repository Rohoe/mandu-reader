/**
 * Prompt builders for Learning Path blueprint generation.
 *
 * The blueprint prompt takes a user's interest profile and generates
 * a structured plan of units (future syllabi) with style annotations.
 */

export function buildLearningPathPrompt(langConfig, profile, nativeLangName = 'English', { useTargetLang } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;
  const descLang = useTargetLang ? p.targetLanguage : nativeLangName;

  const interestSection = profile.interests
    ? `Interests: ${profile.interests}\n`
    : '';
  const goalSection = profile.goals
    ? `Goals: ${profile.goals}\n`
    : '';
  const commitmentMap = { casual: '1-2 sessions/week', regular: '3-4 sessions/week', intensive: '5+ sessions/week' };
  const commitmentSection = profile.commitment
    ? `Time commitment: ${commitmentMap[profile.commitment] || profile.commitment}\n`
    : '';
  const priorSection = profile.priorKnowledge
    ? `Already studied: ${profile.priorKnowledge}\n`
    : '';
  const freeTextSection = profile.freeText
    ? `\nAdditional context from learner:\n${profile.freeText}\n`
    : '';

  return `You are a ${p.curriculumDesigner} and educational architect. Design a comprehensive Learning Path — a textbook-scale curriculum plan for a language learner.

## Learner Profile
Target language: ${p.targetLanguage}
${profName} Level: ${profile.level}
${interestSection}${goalSection}${commitmentSection}${priorSection}${freeTextSection}
## Task
Create a structured learning path with 6-15 units. Each unit is like a textbook chapter — it will later be expanded into a full syllabus with 6-12 individual lessons.

## Unit Design Principles
- **Progressive difficulty**: Early units consolidate fundamentals, later units stretch toward the next level.
- **Variety of styles**: Assign each unit one of these styles:
  - \`"thematic"\`: Topic/vocabulary-focused (e.g., "Food Culture", "Business Etiquette"). Best for building vocabulary around a theme.
  - \`"narrative"\`: Story-driven with characters and plot arc (e.g., "Retelling Journey to the West", "A Day in Edo-period Kyoto"). Best for reading comprehension and cultural immersion.
  - \`"exploratory"\`: Cultural context, comparisons, essays (e.g., "Comparing Eastern and Western Philosophy", "Modern Pop Culture"). Best for advanced reading and critical thinking.
- **Natural mix**: Most paths should blend styles. A history-focused path might alternate narrative chapters with thematic vocabulary units. A general proficiency path should mix all three.
- **No overlap**: Each unit should cover distinct vocabulary themes and topics. If two units touch related areas, explicitly differentiate their focus.

## Source Material (for narrative units)
For units with style "narrative", include a \`source_material\` object with relevant details (title, author, period) if the narrative is based on a specific text. Leave null for fictional/original narratives.

Return a JSON object:
{
  "title": "Learning path title in ${descLang}",
  "description": "2-4 sentence overview of what the learner will achieve (in ${descLang})",
  "units": [
    {
      "title": "Unit title in ${descLang}",
      "description": "2-3 sentence description of focus and what the learner gains (in ${descLang})",
      "estimated_lessons": number (6-12),
      "style": "thematic|narrative|exploratory",
      "vocab_themes": ["3-5 vocabulary theme keywords"],
      "source_material": { "title": "...", "author": "...", "period": "..." } | null
    }
  ],
  "continuation_context": {
    "total_units_planned": number,
    "thematic_arc": "One sentence describing the overall arc/progression"
  }
}

Return ONLY valid JSON. No explanation, no markdown fences.`;
}

/**
 * Prompt to extend an existing Learning Path with additional units.
 */
export function buildExtendPathPrompt(langConfig, path, additionalCount, nativeLangName = 'English', { useTargetLang } = {}) {
  const p = langConfig.prompts;
  const profName = langConfig.proficiency.name;
  const descLang = useTargetLang ? p.targetLanguage : nativeLangName;

  const existingUnits = path.units.map((u, i) =>
    `${i + 1}. "${u.title}" (${u.style}) — ${u.description}`
  ).join('\n');

  const coveredSection = path.coveredVocab.length > 0
    ? `\nVocabulary already covered (do NOT repeat): ${path.coveredVocab.slice(0, 100).join(', ')}\n`
    : '';

  const coveredTopicsSection = path.coveredTopics.length > 0
    ? `\nTopics already covered: ${path.coveredTopics.join(', ')}\n`
    : '';

  const arcSection = path.continuationContext?.thematicArc
    ? `\nOverall thematic arc: ${path.continuationContext.thematicArc}\n`
    : '';

  return `You are a ${p.curriculumDesigner} and educational architect. Extend an existing Learning Path with ${additionalCount} new units.

## Existing Path
Title: ${path.title}
Description: ${path.description}
${profName} Level: ${path.level}
${arcSection}
### Existing Units (${path.units.length} total)
${existingUnits}
${coveredSection}${coveredTopicsSection}
## Task
Generate ${additionalCount} NEW units that continue this learning path. They must:
- Build on what came before (progressively harder or deeper)
- Not repeat vocabulary themes or topics from existing units
- Maintain variety in unit styles (thematic/narrative/exploratory)
- Feel like natural continuations of the path's arc

Return a JSON object:
{
  "units": [
    {
      "title": "Unit title in ${descLang}",
      "description": "2-3 sentences (in ${descLang})",
      "estimated_lessons": number (6-12),
      "style": "thematic|narrative|exploratory",
      "vocab_themes": ["3-5 keywords"],
      "source_material": { "title": "...", "author": "...", "period": "..." } | null
    }
  ],
  "continuation_context": {
    "total_units_planned": number,
    "thematic_arc": "Updated arc description"
  }
}

Return ONLY valid JSON. No explanation, no markdown fences.`;
}
