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
 * Builds a compact learner context string (~100-150 tokens) for adaptive reader generation.
 * Returns null if insufficient data for meaningful adaptation.
 */
export function buildLearnerContext(learnedVocabulary, generatedReaders, learningActivity, langId) {
  const vocab = learnedVocabulary || {};
  const langWords = Object.entries(vocab).filter(
    ([, info]) => (info.langId || 'zh') === langId && (info.reviewCount ?? 0) > 0
  );

  // Require at least 5 reviewed words in target language
  if (langWords.length < 5) return null;

  const sections = [];

  // ── Section A: Vocabulary Mastery ──────────────────────────
  const struggling = [];
  let masteredCount = 0;
  let learningCount = 0;

  for (const [word, info] of langWords) {
    const interval = info.interval ?? 0;
    const lapses = info.lapses ?? 0;
    const reviewCount = info.reviewCount ?? 0;

    if (lapses >= 2 || (interval <= 1 && reviewCount >= 3)) {
      struggling.push({ word, lapses, interval });
    } else if (interval >= 21) {
      masteredCount++;
    } else {
      learningCount++;
    }
  }

  // Sort struggling: most lapses first, then shortest interval
  struggling.sort((a, b) => b.lapses - a.lapses || a.interval - b.interval);
  const strugglingWords = struggling.slice(0, 15).map(s => s.word);

  let vocabSection = `Vocabulary: ${langWords.length} reviewed (${masteredCount} mastered, ${learningCount} learning, ${struggling.length} struggling)`;
  if (strugglingWords.length > 0) {
    vocabSection += `\nStruggling words (reinforce these): ${strugglingWords.join(', ')}`;
  }
  sections.push(vocabSection);

  // ── Section B: Recent Quiz Performance ─────────────────────
  const quizActivities = (learningActivity || [])
    .filter(a => a.type === 'quiz_graded')
    .slice(-5);

  if (quizActivities.length > 0 && generatedReaders) {
    const scores = quizActivities.map(a => a.score).filter(s => s != null);
    const weakGrammar = [];

    for (const qa of quizActivities) {
      const reader = qa.lessonKey ? generatedReaders[qa.lessonKey] : null;
      if (!reader || (reader.langId || 'zh') !== langId) continue;
      if (qa.questionScores) {
        for (let i = 0; i < qa.questionScores.length; i++) {
          if (qa.questionScores[i] <= 2 && reader.grammarNotes) {
            for (const note of reader.grammarNotes) {
              if (note.pattern && !weakGrammar.includes(note.pattern)) {
                weakGrammar.push(note.pattern);
              }
            }
          }
        }
      }
    }

    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
      let quizSection = `Recent quiz avg: ${avg}/5`;
      if (weakGrammar.length > 0) {
        quizSection += `\nWeak grammar areas: ${weakGrammar.slice(0, 5).join(', ')}`;
      }
      sections.push(quizSection);
    }
  }

  // ── Section C: Learning Trajectory ─────────────────────────
  const allLangWords = Object.entries(vocab).filter(
    ([, info]) => (info.langId || 'zh') === langId
  );
  if (allLangWords.length >= 10) {
    const now = Date.now();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    let recent = 0;
    let prior = 0;

    for (const [, info] of allLangWords) {
      if (!info.dateAdded) continue;
      const added = new Date(info.dateAdded).getTime();
      const age = now - added;
      if (age <= fourteenDays) recent++;
      else if (age <= fourteenDays * 2) prior++;
    }

    if (recent > 0 || prior > 0) {
      if (recent > prior) {
        sections.push('Trajectory: accelerating — appropriate to introduce slightly more challenging vocabulary');
      } else if (prior > recent && prior > 0) {
        sections.push('Trajectory: decelerating — prioritize consolidation and familiar contexts');
      }
    }
  }

  const result = sections.join('\n');

  // Hard cap: truncate struggling words if over 500 chars
  if (result.length > 500) {
    // Rebuild with fewer struggling words
    const trimmedWords = strugglingWords.slice(0, 8);
    let trimmedVocab = `Vocabulary: ${langWords.length} reviewed (${masteredCount} mastered, ${learningCount} learning, ${struggling.length} struggling)`;
    if (trimmedWords.length > 0) {
      trimmedVocab += `\nStruggling words (reinforce these): ${trimmedWords.join(', ')}`;
    }
    return [trimmedVocab, ...sections.slice(1)].join('\n').slice(0, 500);
  }

  return result;
}

/**
 * Builds a compact learner profile string for adaptive syllabus generation.
 * Returns null if insufficient data (<5 words known).
 */
export function buildLearnerProfile(learnedVocabulary, generatedReaders, syllabi, learningActivity, langId) {
  const vocab = learnedVocabulary || {};
  const langWords = Object.entries(vocab).filter(
    ([, info]) => (info.langId || 'zh') === langId
  );

  if (langWords.length < 5) return null;

  const sections = [];

  // Vocab counts + struggling words
  let mastered = 0, learning = 0, newCount = 0;
  const struggling = [];
  for (const [word, info] of langWords) {
    const rc = info.reviewCount ?? 0;
    const interval = info.interval ?? 0;
    const lapses = info.lapses ?? 0;
    if (rc === 0) newCount++;
    else if (interval >= 21) mastered++;
    else learning++;
    if (lapses >= 2 || (interval <= 1 && rc >= 3)) {
      struggling.push({ word, lapses, interval });
    }
  }
  sections.push(`Known vocabulary: ${langWords.length} words (${mastered} mastered, ${learning} learning, ${newCount} new)`);
  if (struggling.length > 0) {
    struggling.sort((a, b) => b.lapses - a.lapses || a.interval - b.interval);
    sections.push(`Struggling words: ${struggling.slice(0, 10).map(s => s.word).join(', ')}`);
  }

  // Grammar patterns from readers
  const grammarSet = new Set();
  for (const [, reader] of Object.entries(generatedReaders || {})) {
    if ((reader.langId || 'zh') !== langId) continue;
    if (reader.grammarNotes) {
      for (const g of reader.grammarNotes) {
        if (g.pattern) grammarSet.add(g.pattern);
      }
    }
  }
  if (grammarSet.size > 0) {
    sections.push(`Grammar covered: ${[...grammarSet].slice(0, 10).join(', ')}`);
  }

  // Topics from syllabi
  const topics = [];
  for (const s of (syllabi || [])) {
    if ((s.langId || 'zh') === langId && s.topic && !topics.includes(s.topic)) {
      topics.push(s.topic);
    }
  }
  if (topics.length > 0) {
    sections.push(`Topics studied: ${topics.slice(0, 5).join(', ')}`);
  }

  // Quiz avg
  const quizActivities = (learningActivity || [])
    .filter(a => a.type === 'quiz_graded')
    .slice(-10);
  if (quizActivities.length > 0) {
    const scores = quizActivities.map(a => a.score).filter(s => s != null);
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
      sections.push(`Recent quiz avg: ${avg}/5`);
    }
  }

  const result = sections.join('\n');
  return result.length > 400 ? result.slice(0, 397) + '...' : result;
}

/**
 * Builds grading context for learner-aware quiz feedback.
 * Returns null if fewer than 3 reviewed words.
 */
export function buildGradingContext(learnedVocabulary, learningActivity, langId) {
  const vocab = learnedVocabulary || {};
  const langWords = Object.entries(vocab).filter(
    ([, info]) => (info.langId || 'zh') === langId && (info.reviewCount ?? 0) > 0
  );

  if (langWords.length < 3) return null;

  let mastered = 0;
  for (const [, info] of langWords) {
    if ((info.interval ?? 0) >= 21) mastered++;
  }

  // Recent quiz avg
  const quizActivities = (learningActivity || [])
    .filter(a => a.type === 'quiz_graded')
    .slice(-5);
  const scores = quizActivities.map(a => a.score).filter(s => s != null);
  const avg = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : null;

  // Classify tone
  let tone;
  if (avg === null) tone = 'developing';
  else if (avg < 2.5) tone = 'struggling';
  else if (avg <= 3.5) tone = 'developing';
  else if (avg <= 4.5) tone = 'proficient';
  else tone = 'advanced';

  const toneAdvice = {
    struggling: 'be encouraging, highlight what they got right, explain mistakes patiently.',
    developing: 'be supportive, explain clearly, suggest specific improvements.',
    proficient: 'acknowledge competence, offer nuanced feedback on style and accuracy.',
    advanced: 'provide concise feedback, focus on subtleties and native-like usage.',
  };

  const avgStr = avg !== null ? `avg quiz score: ${avg}/5, ` : '';
  const result = `Learner level: ${tone} (${avgStr}${langWords.length} words known, ${mastered} mastered)\nAdapt feedback: ${toneAdvice[tone]}`;
  return result.length > 200 ? result.slice(0, 197) + '...' : result;
}

/**
 * Builds review context for smart review lessons.
 * Returns null if <3 completed lessons or no struggling words found.
 */
export function buildReviewContext(learnedVocabulary, generatedReaders, learningActivity, syllabusId, completedLessons, langId) {
  if (!completedLessons || completedLessons.length < 3) return null;

  const vocab = learnedVocabulary || {};
  const readers = generatedReaders || {};

  // Collect vocabulary from completed lessons
  const lessonVocab = [];
  const weakGrammar = [];
  for (const idx of completedLessons) {
    const reader = readers[`lesson_${syllabusId}_${idx}`];
    if (!reader) continue;
    if (reader.vocabulary) {
      for (const v of reader.vocabulary) {
        const word = v.target || v.chinese || v.korean || v.word || '';
        if (word && !lessonVocab.includes(word)) lessonVocab.push(word);
      }
    }
    // Collect grammar from low-scoring quizzes
    if (reader.grammarNotes) {
      const quizEntry = (learningActivity || []).find(
        a => a.type === 'quiz_graded' && a.lessonKey === `lesson_${syllabusId}_${idx}`
      );
      if (quizEntry && quizEntry.score != null && quizEntry.score <= 3) {
        for (const g of reader.grammarNotes) {
          if (g.pattern && !weakGrammar.includes(g.pattern)) weakGrammar.push(g.pattern);
        }
      }
    }
  }

  // Cross-ref with SRS data to find struggling words
  const strugglingWords = [];
  for (const word of lessonVocab) {
    const info = vocab[word];
    if (!info) continue;
    const interval = info.interval ?? 0;
    const lapses = info.lapses ?? 0;
    const reviewCount = info.reviewCount ?? 0;
    if (lapses >= 2 || (interval <= 1 && reviewCount >= 3) || (interval <= 3 && reviewCount >= 2)) {
      strugglingWords.push(word);
    }
  }

  if (strugglingWords.length === 0) return null;

  const top = strugglingWords.slice(0, 10);
  const summaryParts = [`Review focus: ${top.length} struggling words: ${top.join(', ')}`];
  if (weakGrammar.length > 0) {
    summaryParts.push(`Weak grammar: ${weakGrammar.slice(0, 5).join(', ')}`);
  }

  return {
    strugglingWords: top,
    weakGrammar: weakGrammar.slice(0, 5),
    summary: summaryParts.join('\n'),
  };
}

/**
 * Determines if a learner is ready to advance to the next proficiency level.
 * Returns null if at max level or insufficient data.
 */
export function getLevelUpRecommendation(learnedVocabulary, learningActivity, generatedReaders, langId, currentLevel) {
  const langConfig = getLang(langId);
  const levels = langConfig.proficiency.levels;

  // Find current and next level
  const currentIdx = levels.findIndex(l => l.value === currentLevel);
  if (currentIdx === -1 || currentIdx >= levels.length - 1) return null;
  const nextLevel = levels[currentIdx + 1];
  const currentLevelConfig = levels[currentIdx];

  if (!nextLevel.wordThreshold || !currentLevelConfig.wordThreshold) return null;

  // Count words known in langId
  const vocab = learnedVocabulary || {};
  const langWords = Object.entries(vocab).filter(
    ([, info]) => (info.langId || 'zh') === langId
  );
  const totalWords = langWords.length;
  const masteredWords = langWords.filter(([, info]) => (info.interval ?? 0) >= 21).length;

  // Quiz avg — filter by langId via generatedReaders
  const quizActivities = (learningActivity || [])
    .filter(a => a.type === 'quiz_graded')
    .slice(-10);
  const langQuizScores = [];
  for (const qa of quizActivities) {
    if (qa.lessonKey && generatedReaders) {
      const reader = generatedReaders[qa.lessonKey];
      if (reader && (reader.langId || 'zh') !== langId) continue;
    }
    if (qa.score != null) langQuizScores.push(qa.score);
  }
  const avgQuiz = langQuizScores.length > 0
    ? langQuizScores.reduce((a, b) => a + b, 0) / langQuizScores.length
    : 0;

  const nextThreshold = nextLevel.wordThreshold;
  const currentThreshold = currentLevelConfig.wordThreshold;
  const reason = `You know ${totalWords} words (${masteredWords} mastered) with an avg quiz score of ${Math.round(avgQuiz * 10) / 10}/5`;

  // "ready": total >= 70% of next threshold AND avg >= 3.5 AND mastered >= 50% of current threshold
  if (totalWords >= nextThreshold * 0.7 && avgQuiz >= 3.5 && masteredWords >= currentThreshold * 0.5) {
    return { currentLevel, nextLabel: nextLevel.label, reason, confidence: 'ready' };
  }

  // "almost": total >= 50% of next threshold AND avg >= 3.0
  if (totalWords >= nextThreshold * 0.5 && avgQuiz >= 3.0) {
    return { currentLevel, nextLabel: nextLevel.label, reason, confidence: 'almost' };
  }

  return null;
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
