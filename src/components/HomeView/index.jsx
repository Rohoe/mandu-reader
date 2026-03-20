import { useAppSelector } from '../../context/useAppSelector';
import { computeStats } from '../../lib/stats';
import { useT } from '../../i18n';
import WeeklyGoals from './WeeklyGoals';
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
  }));

  const stats = computeStats(state);

  // Determine "Continue Learning" — most recently active non-archived content
  const lastStandalone = state.standaloneReaders
    .filter(r => !r.archived)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

  const lastSyllabus = state.syllabi
    .filter(s => !s.archived)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

  const lastProgress = lastSyllabus ? state.syllabusProgress[lastSyllabus.id] : null;

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

      {/* Continue Learning */}
      {(lastSyllabus || lastStandalone) && (
        <div className="home-continue">
          <h2 className="home-continue__title font-display">{t('home.continueLearning')}</h2>
          {lastSyllabus && (
            <button
              className="home-continue__card"
              onClick={() => {
                const idx = lastProgress?.lessonIndex || 0;
                onSelectLesson?.(lastSyllabus.id, idx);
              }}
            >
              <span className="home-continue__topic">{lastSyllabus.topic}</span>
              <span className="home-continue__meta">
                {(lastProgress?.completedLessons?.length || 0)}/{lastSyllabus.lessons?.length || 0} lessons
              </span>
            </button>
          )}
          {lastStandalone && (
            <button
              className="home-continue__card"
              onClick={() => onSelectStandalone?.(lastStandalone.key)}
            >
              <span className="home-continue__topic">{lastStandalone.topic}</span>
              <span className="home-continue__meta">Reader</span>
            </button>
          )}
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
