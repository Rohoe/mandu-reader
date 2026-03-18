import { useT } from '../../i18n';

const TYPE_ICONS = {
  reading: '📖',
  flashcards: '🃏',
  quiz: '✏️',
  tutor: '💬',
  review: '🔄',
};

const TYPE_LABELS = {
  reading: 'plan.activity.reading',
  flashcards: 'plan.activity.flashcards',
  quiz: 'plan.activity.quiz',
  tutor: 'plan.activity.tutor',
  review: 'plan.activity.review',
};

export default function ActivityCard({ activity, locked, onClick, onSkip, onUndo }) {
  const t = useT();
  const { type, title, description, estimatedMinutes, status } = activity;
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  const isInProgress = status === 'in_progress';
  const isClickable = !isCompleted && !isSkipped && !locked;

  return (
    <div
      className={`activity-card ${isCompleted ? 'activity-card--completed' : ''} ${isSkipped ? 'activity-card--skipped' : ''} ${isInProgress ? 'activity-card--in-progress' : ''} ${locked ? 'activity-card--locked' : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="activity-card__icon">
        {isCompleted ? '✓' : locked ? '🔒' : TYPE_ICONS[type] || '•'}
      </div>
      <div className="activity-card__content">
        <div className="activity-card__header">
          <span className="activity-card__type">{t(TYPE_LABELS[type] || 'plan.activity.reading')}</span>
          <span className="activity-card__time">{estimatedMinutes} min</span>
        </div>
        <span className="activity-card__title">{title}</span>
        {locked
          ? <span className="activity-card__desc activity-card__locked-hint">{t('plan.dashboard.completeReadingFirst')}</span>
          : description && <span className="activity-card__desc">{description}</span>}
      </div>
      {isCompleted && (
        <button
          className="activity-card__undo"
          onClick={e => { e.stopPropagation(); onUndo?.(); }}
          title={t('plan.dashboard.undo') || 'Undo'}
          aria-label={t('plan.dashboard.undo') || 'Undo'}
        >
          ↩
        </button>
      )}
      {!isCompleted && !isSkipped && !locked && (
        <button
          className="activity-card__skip"
          onClick={e => { e.stopPropagation(); onSkip?.(); }}
          title={t('plan.dashboard.skip')}
          aria-label={t('plan.dashboard.skip')}
        >
          ✕
        </button>
      )}
    </div>
  );
}
