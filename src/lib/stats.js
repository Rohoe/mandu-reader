/**
 * Derives learning statistics from app state + activity log.
 */

import { getLang } from './languages';

export function computeStats(state) {
  const { learnedVocabulary, syllabi, syllabusProgress, standaloneReaders, learningActivity, readingTime, generatedReaders } = state;

  // ── Vocabulary stats ───────────────────────────────────────
  const vocabEntries = Object.entries(learnedVocabulary || {});
  const totalWords = vocabEntries.length;

  const wordsByLang = {};
  for (const [, info] of vocabEntries) {
    const lang = info.langId || 'zh';
    wordsByLang[lang] = (wordsByLang[lang] || 0) + 1;
  }

  const wordsByPeriod = getWordsByPeriod(learnedVocabulary, 'week');

  // ── Quiz stats ─────────────────────────────────────────────
  const quizActivities = (learningActivity || []).filter(a => a.type === 'quiz_graded');
  const quizScores = quizActivities.map(a => a.score).filter(s => s != null);
  const avgQuizScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length * 10) / 10
    : null;

  // ── Completion stats ───────────────────────────────────────
  let totalLessons = 0;
  let completedLessons = 0;
  for (const s of syllabi) {
    totalLessons += (s.lessons || []).length;
    const progress = syllabusProgress[s.id];
    if (progress) completedLessons += (progress.completedLessons || []).length;
  }
  const readersGenerated = (learningActivity || []).filter(a => a.type === 'reader_generated').length;

  // ── Streak ─────────────────────────────────────────────────
  const streak = getStreak(learningActivity);

  // ── Flashcard stats ───────────────────────────────────────
  const flashcardActivities = (learningActivity || []).filter(a => a.type === 'flashcard_reviewed');
  const totalFlashcardReviews = flashcardActivities.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const reviewsToday = flashcardActivities.filter(a => (a.timestamp || 0) >= todayMs).length;

  const gotCount = flashcardActivities.filter(a => a.judgment === 'got').length;
  const retentionRate = totalFlashcardReviews > 0
    ? Math.round(gotCount / totalFlashcardReviews * 100)
    : null;

  // Mastery breakdown from learnedVocabulary
  let fcMastered = 0, fcLearning = 0, fcNew = 0;
  for (const [, info] of vocabEntries) {
    const rc = info.reviewCount ?? 0;
    const interval = info.interval ?? 0;
    if (rc === 0) fcNew++;
    else if (interval >= 21) fcMastered++;
    else fcLearning++;
  }

  const flashcardStreak = getFlashcardStreak(learningActivity);
  const reviewForecast = getReviewForecast(learnedVocabulary);
  const retentionCurve = getRetentionCurve(learningActivity);
  const reviewHeatmap = getReviewHeatmap(learningActivity);
  const readingStats = getReadingStats(readingTime, generatedReaders);

  return {
    totalWords,
    wordsByLang,
    wordsByPeriod,
    avgQuizScore,
    totalLessons,
    completedLessons,
    readersGenerated,
    standaloneCount: standaloneReaders.length,
    syllabusCount: syllabi.length,
    streak,
    quizCount: quizActivities.length,
    // Flashcard stats
    totalFlashcardReviews,
    reviewsToday,
    retentionRate,
    flashcardMastery: { mastered: fcMastered, learning: fcLearning, new: fcNew },
    flashcardStreak,
    reviewForecast,
    retentionCurve,
    reviewHeatmap,
    // Reading stats
    readingStats,
  };
}

export function getStreak(activity) {
  if (!activity || activity.length === 0) return 0;

  const days = new Set();
  for (const a of activity) {
    if (a.timestamp) {
      const d = new Date(a.timestamp);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }

  if (days.size === 0) return 0;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Check if today or yesterday is in the set (streak must be current)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  if (!days.has(todayKey) && !days.has(yesterdayKey)) return 0;

  let streak = 0;
  const check = new Date(today);
  // Start from today if today is active, otherwise yesterday
  if (!days.has(todayKey)) check.setDate(check.getDate() - 1);

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

export function getFlashcardStreak(activity) {
  if (!activity || activity.length === 0) return 0;
  const fcActivities = activity.filter(a => a.type === 'flashcard_reviewed');
  if (fcActivities.length === 0) return 0;
  return getStreak(fcActivities);
}

/**
 * 7-day review forecast from nextReview/reverseNextReview dates.
 */
export function getReviewForecast(learnedVocabulary) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    let count = 0;

    for (const info of Object.values(learnedVocabulary || {})) {
      if (info.nextReview) {
        const nr = new Date(info.nextReview).getTime();
        if (i === 0 ? nr <= dayEnd : (nr >= dayStart && nr < dayEnd)) count++;
      }
      if (info.reverseNextReview) {
        const rr = new Date(info.reverseNextReview).getTime();
        if (i === 0 ? rr <= dayEnd : (rr >= dayStart && rr < dayEnd)) count++;
      }
    }

    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
    days.push({ label, count });
  }
  return days;
}

/**
 * 8-week retention rate from flashcard_reviewed activity.
 */
export function getRetentionCurve(learningActivity) {
  const weeks = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowMs = now.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const fcActivities = (learningActivity || []).filter(a => a.type === 'flashcard_reviewed');

  for (let i = 7; i >= 0; i--) {
    const weekStart = nowMs - (i + 1) * weekMs;
    const weekEnd = nowMs - i * weekMs;
    const inWeek = fcActivities.filter(a => a.timestamp >= weekStart && a.timestamp < weekEnd);
    const gotCount = inWeek.filter(a => a.judgment === 'got').length;
    const rate = inWeek.length > 0 ? Math.round(gotCount / inWeek.length * 100) : null;
    const label = i === 0 ? 'This wk' : i === 1 ? 'Last wk' : `${i}wk ago`;
    weeks.push({ label, rate, total: inWeek.length });
  }
  return weeks;
}

/**
 * 364-day review heatmap grid with intensity levels 0-4.
 */
export function getReviewHeatmap(learningActivity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  // Count reviews per day
  const dayCounts = {};
  const fcActivities = (learningActivity || []).filter(a => a.type === 'flashcard_reviewed');
  for (const a of fcActivities) {
    const d = new Date(a.timestamp);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }

  // Build 364-day grid (52 weeks)
  const grid = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today.getTime() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    const count = dayCounts[key] || 0;
    let level;
    if (count === 0) level = 0;
    else if (count <= 5) level = 1;
    else if (count <= 15) level = 2;
    else if (count <= 30) level = 3;
    else level = 4;
    grid.push({ date: key, count, level });
  }
  return grid;
}

export function getWordsByPeriod(vocab, period = 'week') {
  if (!vocab) return [];

  const now = new Date();
  const buckets = {};

  // Determine bucket count and format
  const bucketCount = period === 'week' ? 8 : 6;

  for (const [, info] of Object.entries(vocab)) {
    if (!info.dateAdded) continue;
    const d = new Date(info.dateAdded);
    let bucketKey;

    if (period === 'week') {
      // Weekly buckets (last 8 weeks)
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const dDay = new Date(d);
      dDay.setHours(0, 0, 0, 0);
      const diffWeeks = Math.floor((weekStart - dDay) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks < 0 || diffWeeks >= bucketCount) continue;
      bucketKey = diffWeeks;
    } else {
      // Monthly buckets (last 6 months)
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (diffMonths < 0 || diffMonths >= bucketCount) continue;
      bucketKey = diffMonths;
    }
    buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
  }

  // Build array from most recent to oldest (reversed for display)
  const result = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const label = i === 0 ? 'This wk' : i === 1 ? 'Last wk' : `${i}wk ago`;
    result.push({ label, count: buckets[i] || 0 });
  }
  return result;
}

/**
 * Count readable units in a text string.
 * For CJK languages (zh, yue): count characters (excluding spaces/punctuation).
 * For alphabetic languages (ko, en): count words.
 */
export function countReadableUnits(text, langId) {
  if (!text) return 0;
  const lang = getLang(langId);
  if (lang.scriptType === 'cjk') {
    // Count CJK characters
    return (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  }
  // Word count for Korean, Latin-script, and other languages
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Compute reading stats from readingTime map and generated readers.
 */
export function getReadingStats(readingTime, generatedReaders) {
  if (!readingTime || Object.keys(readingTime).length === 0) return null;

  let totalSeconds = 0;
  let totalUnits = 0;
  let sessionsWithText = 0;

  for (const [key, seconds] of Object.entries(readingTime)) {
    totalSeconds += seconds;
    const reader = generatedReaders?.[key];
    if (reader && seconds > 0) {
      const langId = reader.langId || 'zh';
      // Sum story text
      const storyText = (reader.story || []).map(s =>
        typeof s === 'string' ? s : s.text || ''
      ).join('');
      const units = countReadableUnits(storyText, langId);
      if (units > 0) {
        totalUnits += units;
        sessionsWithText++;
      }
    }
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  const sessionsCount = Object.keys(readingTime).length;
  // Units per minute (characters/min for CJK, words/min for alphabetic)
  const unitsPerMinute = totalSeconds > 60 && totalUnits > 0
    ? Math.round(totalUnits / (totalSeconds / 60))
    : null;

  return {
    totalMinutes,
    sessionsCount,
    totalUnits,
    unitsPerMinute,
    sessionsWithText,
  };
}
