import { useT } from '../../i18n';
import './NextActionSuggestion.css';

/**
 * NextActionSuggestion — displays contextual "what to do next" suggestions.
 */
export default function NextActionSuggestion({ actions, onShowFlashcards, onSelectLesson, onShowNewForm }) {
  const t = useT();

  if (!actions || actions.length === 0) return null;

  function handleClick(action) {
    switch (action.type) {
      case 'flashcards':
      case 'practice_struggling':
      case 'review_grammar':
        onShowFlashcards?.();
        break;
      case 'continue_lesson':
        onSelectLesson?.(action.syllabusId, action.lessonIndex);
        break;
      case 'streak_protection':
        onShowFlashcards?.();
        break;
      case 'create_new':
        onShowNewForm?.();
        break;
    }
  }

  function getLabel(action) {
    switch (action.type) {
      case 'flashcards':
        return t('nextAction.dueFlashcards', { count: action.count });
      case 'continue_lesson':
        return t('nextAction.continueLesson', { topic: action.topic });
      case 'streak_protection':
        return t('nextAction.streakProtection', { count: action.count });
      case 'practice_struggling':
        return t('nextAction.practiceStruggling', { count: action.count });
      case 'review_grammar':
        return t('nextAction.reviewGrammar');
      case 'create_new':
        return t('nextAction.createNew');
      default:
        return '';
    }
  }

  return (
    <div className="next-actions">
      <h3 className="next-actions__title text-muted">{t('nextAction.title')}</h3>
      <div className="next-actions__list">
        {actions.map((action, i) => (
          <button
            key={action.type + i}
            className={`next-actions__card ${i === 0 ? 'next-actions__card--primary' : ''}`}
            onClick={() => handleClick(action)}
          >
            {getLabel(action)}
          </button>
        ))}
      </div>
    </div>
  );
}
