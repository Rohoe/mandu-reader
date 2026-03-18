import { useT } from '../../i18n';
import ActivityCard from './ActivityCard';

export default function DayColumn({ day, dayIndex, dayName, isToday, onActivityClick, onSkip, onUndo }) {
  const t = useT();
  const activities = day?.activities || [];

  if (activities.length === 0) {
    return (
      <div className="plan-day-column plan-day-column--empty">
        <p className="text-muted">{t('plan.dashboard.restDay')}</p>
      </div>
    );
  }

  const totalMinutes = activities.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);

  // Activities that depend on a reading being completed first
  const dependentTypes = new Set(['flashcards', 'quiz', 'tutor', 'review']);
  const hasCompletedReading = activities.some(
    a => a.type === 'reading' && a.status === 'completed'
  );

  return (
    <div className="plan-day-column fade-in">
      <div className="plan-day-column__header">
        <span className="plan-day-column__label">
          {dayName} {isToday && <span className="plan-day-column__today-badge">{t('plan.dashboard.today')}</span>}
        </span>
        <span className="plan-day-column__time text-muted">{totalMinutes} min</span>
      </div>
      <div className="plan-day-column__activities">
        {activities.map(activity => {
          const locked = dependentTypes.has(activity.type)
            && !hasCompletedReading
            && activity.status !== 'completed'
            && activity.status !== 'skipped';
          return (
            <ActivityCard
              key={activity.id}
              activity={activity}
              locked={locked}
              onClick={() => onActivityClick(activity)}
              onSkip={() => onSkip(activity.id)}
              onUndo={() => onUndo?.(activity.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
