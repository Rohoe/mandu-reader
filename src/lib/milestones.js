/**
 * Milestone detection — checks for newly-earned milestones.
 */

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

// Vocab thresholds per milestone
const VOCAB_THRESHOLDS = [10, 25, 50, 100, 200, 500, 1000];

/**
 * Check for newly-earned milestones that haven't been shown yet.
 * @param {object} state - App state (needs: learnedVocabulary, learningActivity, syllabi, shownMilestones)
 * @returns {Array<{ id: string, type: string, label: string, sublabel: string, count?: number }>}
 */
export function checkMilestones(state) {
  const { learnedVocabulary, learningActivity, syllabi, shownMilestones } = state;
  const shown = shownMilestones || new Set();
  const milestones = [];

  // Vocab count milestones
  const totalWords = Object.keys(learnedVocabulary || {}).length;
  for (const threshold of VOCAB_THRESHOLDS) {
    const id = `vocab_${threshold}`;
    if (totalWords >= threshold && !shown.has(id)) {
      milestones.push({ id, type: 'vocab', count: threshold });
    }
  }

  // Streak milestones (from activity)
  const streak = getSimpleStreak(learningActivity);
  for (const threshold of STREAK_MILESTONES) {
    const id = `streak_${threshold}`;
    if (streak >= threshold && !shown.has(id)) {
      milestones.push({ id, type: 'streak', count: threshold });
    }
  }

  // Firsts
  const activity = learningActivity || [];

  if (!shown.has('first_lesson') && activity.some(a => a.type === 'lesson_completed')) {
    milestones.push({ id: 'first_lesson', type: 'first_lesson' });
  }

  if (!shown.has('first_quiz') && activity.some(a => a.type === 'quiz_graded')) {
    milestones.push({ id: 'first_quiz', type: 'first_quiz' });
  }

  if (!shown.has('first_syllabus') && (syllabi || []).length > 0) {
    // Only count non-demo syllabi
    const hasReal = (syllabi || []).some(s => !s.isDemo);
    if (hasReal) {
      milestones.push({ id: 'first_syllabus', type: 'first_syllabus' });
    }
  }

  return milestones;
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
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  if (!days.has(todayKey) && !days.has(yesterdayKey)) return 0;
  let streak = 0;
  const check = new Date(today);
  if (!days.has(todayKey)) check.setDate(check.getDate() - 1);
  while (true) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (days.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  return streak;
}
