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

/**
 * Build an interactive prompt where the LLM interviews the user to
 * design a personalized Learning Path. The user pastes this into
 * Claude, ChatGPT, etc. and has a back-and-forth conversation.
 * The final output is structured JSON matching the Mandu import schema.
 */
export function buildInteractiveDesignPrompt(langName, nativeLangName = 'English') {
  return `You are a language learning curriculum designer. Your job is to help me design a personalized Learning Path for studying ${langName} — a structured plan of reading units I can import into my graded reader app.

## How this works

**Phase 1: Interview me (ask one question at a time)**

Have a conversation with me to understand what I want. Ask 4–6 questions, one at a time, waiting for my answer before asking the next. Cover these areas:

1. **Current level** — How much ${langName} do I already know? Am I a complete beginner, intermediate, or advanced? What proficiency level or exam am I targeting?
2. **Interests & motivation** — Why am I learning ${langName}? What topics excite me? (travel, business, history, pop culture, food, literature, science, daily life, exam prep…)
3. **Specific topics** — Any particular subjects I'd love to read about? A historical period, a hobby, a cultural topic, a book I want to read in ${langName}?
4. **Learning style** — Do I want a broad survey of topics, or a deep dive into one theme? Do I prefer fiction-style narratives, informational articles, or a mix?
5. **Time commitment** — How often will I study? (casual: 1-2x/week, regular: 3-4x/week, intensive: daily)
6. **Anything to avoid** — Topics or styles I don't want?

Be conversational, encouraging, and brief. Don't ask all questions at once — wait for each answer.

**Phase 2: Present the plan**

Once you understand my preferences, design a learning path with 6-15 units (like textbook chapters). Present it as a numbered list with brief descriptions so I can review it. Ask if I want any changes. Iterate until I'm happy.

**Phase 3: Output structured JSON**

When I approve the plan, output the final result as a JSON code block using EXACTLY this format:

\`\`\`json
{
  "version": 1,
  "type": "learning_path",
  "path": {
    "title": "Path title",
    "description": "2-4 sentence overview in ${nativeLangName}",
    "langId": "LANG_CODE",
    "level": LEVEL_NUMBER,
    "units": [
      {
        "title": "Unit title in ${nativeLangName}",
        "description": "2-3 sentence description in ${nativeLangName}",
        "estimated_lessons": 8,
        "style": "thematic",
        "vocab_themes": ["theme1", "theme2", "theme3"],
        "source_material": null
      }
    ],
    "continuation_context": {
      "total_units_planned": 12,
      "thematic_arc": "One sentence describing the overall progression"
    }
  }
}
\`\`\`

### Field rules
- \`langId\`: use one of "zh" (Mandarin), "yue" (Cantonese), "ko" (Korean), "fr" (French), "es" (Spanish), "en" (English)
- \`level\`: integer matching the language's proficiency scale (e.g. HSK 1-6 for Chinese, TOPIK 1-6 for Korean, CEFR 1-6 for French/Spanish/English)
- \`style\`: one of "thematic" (topic/vocabulary focus), "narrative" (story-driven with characters), or "exploratory" (cultural essays, comparisons)
- \`source_material\`: for narrative units based on a specific text, include \`{"title": "...", "author": "...", "period": "..."}\`. Otherwise \`null\`.
- \`estimated_lessons\`: 6-12 lessons per unit
- \`vocab_themes\`: 3-5 keywords in ${nativeLangName}

After outputting the JSON, tell me: "Copy the JSON above, then go to Learning Paths → Import in Mandu Reader to import it."

---

Start by greeting me and asking your first question!`;
}
