import { useT } from '../i18n';
import './MilestoneCelebration.css';

const ICONS = {
  vocab: '\u{1F4DA}',
  streak: '\u{1F525}',
  first_lesson: '\u{1F393}',
  first_quiz: '\u{2705}',
  first_syllabus: '\u{1F4CB}',
};

export default function MilestoneCelebration({ milestone, onDismiss }) {
  const t = useT();
  if (!milestone) return null;

  let label, sublabel;
  switch (milestone.type) {
    case 'vocab':
      label = t('milestone.vocabCount', { count: milestone.count });
      sublabel = t('milestone.vocabSub');
      break;
    case 'streak':
      label = t('milestone.streak', { count: milestone.count });
      sublabel = t('milestone.streakSub');
      break;
    case 'first_lesson':
      label = t('milestone.firstLesson');
      sublabel = t('milestone.firstLessonSub');
      break;
    case 'first_quiz':
      label = t('milestone.firstQuiz');
      sublabel = t('milestone.firstQuizSub');
      break;
    case 'first_syllabus':
      label = t('milestone.firstSyllabus');
      sublabel = t('milestone.firstSyllabusSub');
      break;
    default:
      return null;
  }

  return (
    <div className="milestone-celebration" role="status" aria-live="polite">
      <span className="milestone-celebration__icon">{ICONS[milestone.type] || '\u{1F3C6}'}</span>
      <div className="milestone-celebration__text">
        <span className="milestone-celebration__label">{label}</span>
        <span className="milestone-celebration__sublabel text-muted">{sublabel}</span>
      </div>
      <button className="milestone-celebration__dismiss" onClick={onDismiss} aria-label="Dismiss">
        \u2715
      </button>
    </div>
  );
}
