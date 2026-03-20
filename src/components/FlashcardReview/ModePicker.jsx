import { useState, useMemo } from 'react';
import { useT } from '../../i18n';

/**
 * Mode picker screen shown when the flashcard modal opens.
 * Two main modes (SRS Review, Quiz Mix) + collapsible practice section.
 */
export default function ModePicker({ dueCount, newCount, langCards, onSelectMode, langId }) {
  const t = useT();
  const [practiceOpen, setPracticeOpen] = useState(false);

  // Compute eligibility counts for practice exercises
  const exerciseCounts = useMemo(() => {
    let fillBlank = 0, listening = 0, matching = 0, sentence = 0, context = 0, reverse = 0;
    for (const c of langCards) {
      const hasExample = c.exampleSentence?.includes(c.target) || c.exampleExtra?.includes(c.target);
      if (hasExample) { fillBlank++; context++; }
      if (c.exampleSentence && c.exampleSentenceTranslation) sentence++;
      listening++; // All cards work for listening (TTS)
      if (c.translation) reverse++;
      matching++; // All cards work for matching
    }
    return { fillBlank, listening, matching, sentence, context, reverse };
  }, [langCards]);

  const practiceExercises = [
    { key: 'fillblank', label: t('flashcard.fillBlank'), count: exerciseCounts.fillBlank },
    { key: 'listening', label: t('flashcard.listening'), count: exerciseCounts.listening },
    { key: 'matching', label: t('flashcard.matching'), count: exerciseCounts.matching },
    { key: 'sentence', label: t('flashcard.sentenceBuilder'), count: exerciseCounts.sentence },
    { key: 'context', label: t('flashcard.contextClue'), count: exerciseCounts.context },
    { key: 'reverse', label: t('flashcard.reverseListening'), count: exerciseCounts.reverse },
  ];

  return (
    <div className="flashcard-mode-picker">
      {/* SRS Review card */}
      <button
        className="flashcard-mode-card"
        onClick={() => onSelectMode('srs')}
      >
        <div className="flashcard-mode-card__header">
          <span className="flashcard-mode-card__title">{t('flashcard.srsReview')}</span>
        </div>
        <p className="flashcard-mode-card__desc">{t('flashcard.srsReviewDesc')}</p>
        <div className="flashcard-mode-card__counts">
          <span className="flashcard-stat-badge flashcard-stat-badge--due">{t('flashcard.due', { count: dueCount })}</span>
          <span className="flashcard-stat-badge flashcard-stat-badge--new">{t('flashcard.new', { count: newCount })}</span>
        </div>
      </button>

      {/* Quiz Mix card */}
      <button
        className="flashcard-mode-card"
        onClick={() => onSelectMode('quizmix')}
      >
        <div className="flashcard-mode-card__header">
          <span className="flashcard-mode-card__title">{t('flashcard.quizMix')}</span>
        </div>
        <p className="flashcard-mode-card__desc">{t('flashcard.quizMixDesc')}</p>
        <div className="flashcard-mode-card__counts">
          <span className="flashcard-stat-badge flashcard-stat-badge--due">{t('flashcard.due', { count: dueCount })}</span>
          <span className="flashcard-stat-badge flashcard-stat-badge--new">{t('flashcard.new', { count: newCount })}</span>
        </div>
      </button>

      {/* Practice specific exercises — collapsible */}
      <button
        className="flashcard-practice-toggle"
        onClick={() => setPracticeOpen(o => !o)}
        aria-expanded={practiceOpen}
      >
        <span className={`flashcard-practice-toggle__arrow ${practiceOpen ? 'flashcard-practice-toggle__arrow--open' : ''}`}>&#9656;</span>
        {t('flashcard.practiceSpecific')}
      </button>

      {practiceOpen && (
        <div className="flashcard-practice-grid">
          {practiceExercises.map(ex => (
            <button
              key={ex.key}
              className="flashcard-practice-btn"
              onClick={() => onSelectMode(ex.key)}
              disabled={ex.count === 0}
            >
              <span className="flashcard-practice-btn__label">{ex.label}</span>
              <span className="flashcard-practice-btn__count text-muted">{ex.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
