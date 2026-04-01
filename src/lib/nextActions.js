/**
 * Smart next-action suggestions — returns ranked suggestions based on current state.
 */

import { countDueCards } from '../components/FlashcardReview/srs';

/**
 * @param {object} state - App state
 * @param {{ maxResults?: number, context?: 'post-lesson'|'dashboard' }} options
 * @returns {Array<{ type: string, label: string, sublabel?: string, priority: number, payload?: object }>}
 */
export function getNextActions(state, { maxResults = 3, context = 'dashboard' } = {}) {
  const actions = [];
  const { learnedVocabulary, learnedGrammar, syllabi, syllabusProgress, standaloneReaders, generatedReaders, learningActivity } = state;

  // 1. Due flashcards (highest priority)
  const dueCount = countDueCards(learnedVocabulary);
  if (dueCount > 0) {
    actions.push({
      type: 'flashcards',
      priority: 100,
      count: dueCount,
    });
  }

  // 2. Continue next lesson in active syllabus
  for (const s of (syllabi || [])) {
    if (s.archived) continue;
    const progress = (syllabusProgress || {})[s.id] || { lessonIndex: 0, completedLessons: [] };
    const completedCount = progress.completedLessons?.length || 0;
    const totalLessons = s.lessons?.length || 0;
    if (totalLessons > 0 && completedCount < totalLessons) {
      const nextIdx = progress.lessonIndex || 0;
      actions.push({
        type: 'continue_lesson',
        priority: 80,
        topic: s.topic,
        syllabusId: s.id,
        lessonIndex: nextIdx,
      });
      break; // Only suggest one course continuation
    }
  }

  // 3. Streak protection
  const streak = getSimpleStreak(learningActivity);
  if (streak >= 2 && context === 'dashboard') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const hasActivityToday = (learningActivity || []).some(a => (a.timestamp || 0) >= todayMs);
    if (!hasActivityToday) {
      actions.push({
        type: 'streak_protection',
        priority: 90,
        count: streak,
      });
    }
  }

  // 4. Practice struggling vocab
  const strugglingCount = countStrugglingWords(learnedVocabulary);
  if (strugglingCount >= 3 && context === 'post-lesson') {
    actions.push({
      type: 'practice_struggling',
      priority: 60,
      count: strugglingCount,
    });
  }

  // 5. Review grammar patterns
  const grammarDue = countDueGrammar(learnedGrammar);
  if (grammarDue > 0) {
    actions.push({
      type: 'review_grammar',
      priority: 50,
      count: grammarDue,
    });
  }

  // 6. Create new content (lowest priority, always available)
  if (context === 'dashboard') {
    actions.push({
      type: 'create_new',
      priority: 10,
    });
  }

  // Sort by priority descending, take top N
  actions.sort((a, b) => b.priority - a.priority);
  return actions.slice(0, maxResults);
}

function getSimpleStreak(activity) {
  if (!activity || activity.length === 0) return 0;
  const days = new Set();
  for (const a of activity) {
    if (a.timestamp) {
      const d = new Date(a.timestamp);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  const today = new Date();
  const check = new Date(today);
  // Start from yesterday (we want to know if streak is at risk)
  check.setDate(check.getDate() - 1);
  let streak = 0;
  while (true) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (days.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function countStrugglingWords(vocab) {
  let count = 0;
  for (const [, info] of Object.entries(vocab || {})) {
    const lapses = info.lapses ?? 0;
    const interval = info.interval ?? 0;
    const reviewCount = info.reviewCount ?? 0;
    if (lapses >= 2 || (interval <= 1 && reviewCount >= 3)) count++;
  }
  return count;
}

function countDueGrammar(grammar) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowMs = now.getTime();
  let count = 0;
  for (const [, info] of Object.entries(grammar || {})) {
    const rc = info.reviewCount ?? 0;
    const nr = info.nextReview ? new Date(info.nextReview).getTime() : null;
    if (rc > 0 && (nr === null || nr <= nowMs)) count++;
  }
  return count;
}
