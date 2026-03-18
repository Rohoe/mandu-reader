/**
 * Weekly plan prompt — generates a 7-day activity schedule.
 */
export function buildWeeklyPlanPrompt(langConfig, plan, weekNumber, priorWeekSummary, learnerProfile, nativeLangName = 'English') {
  const profName = langConfig.proficiency.name;
  const langName = langConfig.name;

  const profileSection = learnerProfile
    ? `\n## Learner Profile\n${learnerProfile}\n`
    : '';

  const priorSection = priorWeekSummary
    ? `\n## Prior Week Summary\n${priorWeekSummary}\n`
    : '';

  const goalsSection = plan.goals
    ? `\nLearning goals: ${plan.goals}`
    : '';

  return `You are a ${langName} language tutor designing a personalized weekly study plan.

## Parameters
Language: ${langName}
${profName} Level: ${plan.currentLevel}
Daily study budget: ${plan.dailyMinutes} minutes
Week number: ${weekNumber}${goalsSection}
${profileSection}${priorSection}
## Activity Types
You can assign these activity types:
- "reading": A graded reader on a specific topic (20 min). Provide a topic and brief description.
- "flashcards": SRS vocabulary review session (10 min). No topic needed.
- "quiz": Comprehension quiz on a previous reading (10 min). Reference a reading from this week.
- "tutor": Conversational practice with AI tutor (15 min). Suggest conversation topics.
- "review": Vocabulary quiz (matching, fill-in-blank, listening) reviewing learned words (10 min). If the Learner Profile lists struggling words, use those as vocabFocus.

## Instructions
Design a 7-day study plan (Monday through Sunday) that:
1. Fits within ${plan.dailyMinutes} minutes per day
2. Includes 2-3 new readings per week on varied, engaging topics
3. Intersperses flashcard reviews (at least every other day)
4. Includes 1-2 quizzes and 1 tutor conversation per week
5. Balances new content with review/consolidation
6. Has a cohesive weekly theme that ties the readings together

Return a JSON object with exactly these keys:
- "theme": A short ${nativeLangName} theme for the week (e.g., "Daily Life in the City")
- "adaptationNotes": Brief ${nativeLangName} notes on how you adapted for this learner (1-2 sentences)
- "days": Array of exactly 7 objects (index 0=Monday through 6=Sunday), each with:
  - "activities": Array of activity objects, each with:
    - "type": one of "reading", "flashcards", "quiz", "tutor", "review"
    - "title": short ${nativeLangName} title for the activity
    - "description": one-sentence ${nativeLangName} description
    - "estimatedMinutes": number (must fit in daily budget)
    - "config": object with type-specific fields:
      - For "reading": { "topic": string, "level": number, "vocabFocus": [3-5 keywords], "description": string }
      - For "flashcards": {}
      - For "quiz": { "readingTitle": string (reference a reading from this week) }
      - For "tutor": { "suggestedTopics": [2-3 conversation starters] }
      - For "review": { "vocabFocus": [3-5 struggling words to reinforce] }

Return ONLY valid JSON. No explanation, no markdown fences.`;
}
