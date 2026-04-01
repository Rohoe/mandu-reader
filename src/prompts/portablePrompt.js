/**
 * Generates a self-contained prompt that users can paste into any LLM
 * (ChatGPT, Claude, etc.) to generate a Learning Path blueprint.
 *
 * The output JSON follows the Mandu import schema so users can
 * paste the result back into Mandu.
 */

export function buildPortablePrompt(profile, langName, nativeLangName = 'English') {
  const interestSection = profile.interests ? `\nInterests: ${profile.interests}` : '';
  const goalSection = profile.goals ? `\nGoals: ${profile.goals}` : '';
  const commitmentMap = { casual: '1-2 sessions/week', regular: '3-4 sessions/week', intensive: '5+ sessions/week' };
  const commitmentSection = profile.commitment ? `\nTime commitment: ${commitmentMap[profile.commitment] || profile.commitment}` : '';
  const priorSection = profile.priorKnowledge ? `\nAlready studied: ${profile.priorKnowledge}` : '';
  const freeTextSection = profile.freeText ? `\nAdditional context: ${profile.freeText}` : '';

  return `I'm learning ${langName} at level ${profile.level}. Please design a comprehensive learning path for me — a structured curriculum plan I can import into my graded reader app.
${interestSection}${goalSection}${commitmentSection}${priorSection}${freeTextSection}

Please create 6-15 units (like textbook chapters). Each unit will later be expanded into 6-12 individual reading lessons. Mix different styles:
- "thematic": vocabulary/topic-focused units (e.g., "Food Culture", "Business Language")
- "narrative": story-driven units with characters and plot (e.g., retelling a classic text, historical fiction)
- "exploratory": cultural essays, comparisons, critical reading

For narrative units based on specific texts, include source_material with title/author/period.

Return ONLY a JSON object in this exact format (no explanation, no markdown fences):

{
  "version": 1,
  "type": "learning_path",
  "path": {
    "title": "Path title",
    "description": "2-4 sentence overview in ${nativeLangName}",
    "langId": "${profile.langId}",
    "level": ${profile.level},
    "units": [
      {
        "title": "Unit title in ${nativeLangName}",
        "description": "2-3 sentence description in ${nativeLangName}",
        "estimated_lessons": 8,
        "style": "thematic",
        "vocab_themes": ["theme1", "theme2", "theme3"],
        "source_material": null
      },
      {
        "title": "Narrative unit example",
        "description": "Story-driven unit description",
        "estimated_lessons": 10,
        "style": "narrative",
        "vocab_themes": ["theme1", "theme2"],
        "source_material": { "title": "Source text", "author": "Author name", "period": "Time period" }
      }
    ],
    "continuation_context": {
      "total_units_planned": 12,
      "thematic_arc": "One sentence describing the overall progression"
    }
  }
}`;
}

/**
 * Build instructions for what the user should do with the LLM output.
 */
export function buildImportInstructions() {
  return `To import the result into Mandu Reader:
1. Copy the JSON output from the LLM
2. In Mandu, go to Learning Paths → Import
3. Paste the JSON and click "Import"

The app will validate the format and create your Learning Path with all units ready to generate.`;
}
