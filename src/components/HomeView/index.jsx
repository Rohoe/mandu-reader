import { useMemo } from 'react';
import { useAppSelector } from '../../context/useAppSelector';
import { computeStats } from '../../lib/stats';
import { getNextActions } from '../../lib/nextActions';
import { useT } from '../../i18n';
import WeeklyGoals from './WeeklyGoals';
import NextActionSuggestion from '../NextActionSuggestion';
import './HomeView.css';

export default function HomeView({
  onShowFlashcards,
  onShowStats,
  onShowNewForm,
  onSelectLesson,
  onSelectStandalone,
}) {
  const t = useT();
  const state = useAppSelector(s => ({
    learnedVocabulary: s.learnedVocabulary,
    syllabi: s.syllabi,
    syllabusProgress: s.syllabusProgress,
    standaloneReaders: s.standaloneReaders,
    learningActivity: s.learningActivity,
    readingTime: s.readingTime,
    generatedReaders: s.generatedReaders,
    learnedGrammar: s.learnedGrammar,
  }));

  const stats = computeStats(state);
  const suggestedActions = useMemo(() => getNextActions(state, { context: 'dashboard' }), [state]);

  // Build "Continue Learning" list — up to 4 items, exclude completed, prioritize in-progress
  const continueItems = useMemo(() => {
    const items = [];

    // Syllabi: exclude archived and fully completed
    for (const s of state.syllabi) {
      if (s.archived) continue;
      const progress = state.syllabusProgress[s.id] || { lessonIndex: 0, completedLessons: [] };
      const completedCount = progress.completedLessons?.length || 0;
      const totalLessons = s.lessons?.length || 0;
      if (totalLessons > 0 && completedCount >= totalLessons) continue;
      items.push({
        type: 'syllabus',
        id: s.id,
        topic: s.topic,
        createdAt: s.createdAt || 0,
        inProgress: completedCount > 0,
        meta: `${completedCount}/${totalLessons} ${t('syllabusHome.lessons').toLowerCase()}`,
        lessonIndex: progress.lessonIndex || 0,
      });
    }

    // Standalone readers: exclude archived and completed
    for (const r of state.standaloneReaders) {
      if (r.archived || r.completedAt) continue;
      items.push({
        type: 'standalone',
        id: r.key,
        topic: r.topic,
        createdAt: r.createdAt || 0,
        inProgress: !!state.generatedReaders[r.key],
        meta: t('toolbar.readers').replace(/s$/, ''),
      });
    }

    // Sort: in-progress first, then by recency
    items.sort((a, b) => {
      if (a.inProgress !== b.inProgress) return a.inProgress ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    return items.slice(0, 4);
  }, [state.syllabi, state.syllabusProgress, state.standaloneReaders, state.generatedReaders, t]);

  return (
    <div className="home-view">
      {/* Hero stats */}
      <div className="home-stats">
        <div className="home-stats__card">
          <span className="home-stats__value">{stats.streak}</span>
          <span className="home-stats__label">{t('home.streak')}</span>
        </div>
        <div className="home-stats__card">
          <span className="home-stats__value">{stats.totalWords}</span>
          <span className="home-stats__label">{t('home.wordsLearned')}</span>
        </div>
        {stats.grammarTotal > 0 && (
          <div className="home-stats__card">
            <span className="home-stats__value">{stats.grammarTotal}</span>
            <span className="home-stats__label">{t('home.grammarLearned')}</span>
          </div>
        )}
        <div className="home-stats__card">
          <span className="home-stats__value">{stats.readingStats?.totalMinutes || 0}</span>
          <span className="home-stats__label">{t('home.minutesRead')}</span>
        </div>
        <div className="home-stats__card">
          <span className="home-stats__value">{stats.retentionRate != null ? `${stats.retentionRate}%` : '—'}</span>
          <span className="home-stats__label">{t('home.retention')}</span>
        </div>
      </div>

      {/* Weekly Goals */}
      <WeeklyGoals />

      {/* Smart Next Actions */}
      {suggestedActions.length > 0 && (
        <NextActionSuggestion
          actions={suggestedActions}
          onShowFlashcards={onShowFlashcards}
          onSelectLesson={onSelectLesson}
          onShowNewForm={onShowNewForm}
        />
      )}

      {/* Continue Learning */}
      {continueItems.length > 0 && (
        <div className="home-continue">
          <h2 className="home-continue__title font-display">{t('home.continueLearning')}</h2>
          {continueItems.map(item => (
            <button
              key={item.id}
              className="home-continue__card"
              onClick={() => {
                if (item.type === 'syllabus') {
                  onSelectLesson?.(item.id, item.lessonIndex);
                } else {
                  onSelectStandalone?.(item.id);
                }
              }}
            >
              <span className="home-continue__topic">{item.topic}</span>
              <span className="home-continue__meta">{item.meta}</span>
            </button>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="home-actions">
        <button className="btn home-actions__btn" onClick={onShowFlashcards}>
          {t('home.reviewFlashcards')}
        </button>
        <button className="btn home-actions__btn" onClick={onShowNewForm}>
          {t('home.createReader')}
        </button>
        <button className="btn home-actions__btn" onClick={onShowStats}>
          {t('home.viewAllStats')}
        </button>
      </div>
    </div>
  );
}
