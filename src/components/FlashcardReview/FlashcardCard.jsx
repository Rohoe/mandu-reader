import { useT } from '../../i18n';
import { isLeech } from './srs';

/**
 * FlashcardCard — the individual card display with flip and rating buttons.
 * Handles both forward (target -> translation) and reverse (translation -> target) directions.
 */
export default function FlashcardCard({
  currentCard,
  currentDirection,
  phase,
  totalCards,
  cardIdx,
  previews,
  history,
  romanizationOn,
  romanizer,
  renderRomanization,
  onReveal,
  onJudge,
  onUndo,
}) {
  const t = useT();
  const showLeech = currentCard && isLeech(currentCard, currentDirection);

  return (
    <>
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: totalCards - cardIdx })}
        </span>
        {history.length > 0 && (
          <button className="btn btn-ghost btn-sm flashcard-undo" onClick={onUndo} title={t('flashcard.undoTooltip')}>
            {t('flashcard.undoBtn')}
          </button>
        )}
      </div>

      <div className="flashcard-card" data-lang={currentCard?.langId}>
        {showLeech && (
          <span className="flashcard-leech-badge" title={t('flashcard.leechHint')}>{t('flashcard.leechBadge')}</span>
        )}
        {currentDirection === 'forward' ? (
          /* Forward card: target on front */
          <>
            <div className="flashcard-card__front">
              <span className="flashcard-card__target text-target">
                {romanizationOn && romanizer && currentCard ? renderRomanization(currentCard.target, 'fc') : currentCard?.target}
              </span>
            </div>

            {phase === 'back' && (
              <div className="flashcard-card__back">
                {currentCard?.romanization && (
                  <span className="flashcard-card__romanization text-muted">{currentCard.romanization}</span>
                )}
                <span className="flashcard-card__translation">{currentCard?.translation}</span>
                {(currentCard?.exampleSentence || currentCard?.exampleExtra) && (
                  <div className="flashcard-card__examples">
                    {currentCard.exampleSentence && (
                      <div className="flashcard-card__example-pair">
                        <span className="flashcard-card__example text-muted">{currentCard.exampleSentence}</span>
                        {currentCard.exampleSentenceTranslation && (
                          <span className="flashcard-card__example-translation text-muted">{currentCard.exampleSentenceTranslation}</span>
                        )}
                      </div>
                    )}
                    {currentCard.exampleExtra && (
                      <div className="flashcard-card__example-pair">
                        <span className="flashcard-card__example text-muted">{currentCard.exampleExtra}</span>
                        {currentCard.exampleExtraTranslation && (
                          <span className="flashcard-card__example-translation text-muted">{currentCard.exampleExtraTranslation}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Reverse card: translation on front */
          <>
            <div className="flashcard-card__front flashcard-card__front--reverse">
              <span className="flashcard-card__translation-front">{currentCard?.translation}</span>
              <span className="flashcard-card__recall-hint text-muted">{t('flashcard.recallTheWord')}</span>
            </div>

            {phase === 'back' && (
              <div className="flashcard-card__back">
                <span className="flashcard-card__target text-target">{currentCard?.target}</span>
                {currentCard?.romanization && (
                  <span className="flashcard-card__romanization text-muted">{currentCard.romanization}</span>
                )}
                {(currentCard?.exampleSentence || currentCard?.exampleExtra) && (
                  <div className="flashcard-card__examples">
                    {currentCard.exampleSentence && (
                      <div className="flashcard-card__example-pair">
                        <span className="flashcard-card__example text-muted">{currentCard.exampleSentence}</span>
                        {currentCard.exampleSentenceTranslation && (
                          <span className="flashcard-card__example-translation text-muted">{currentCard.exampleSentenceTranslation}</span>
                        )}
                      </div>
                    )}
                    {currentCard.exampleExtra && (
                      <div className="flashcard-card__example-pair">
                        <span className="flashcard-card__example text-muted">{currentCard.exampleExtra}</span>
                        {currentCard.exampleExtraTranslation && (
                          <span className="flashcard-card__example-translation text-muted">{currentCard.exampleExtraTranslation}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {phase === 'front' ? (
        <div className="flashcard-actions">
          <button className="btn btn-secondary" onClick={onReveal}>{t('flashcard.showAnswer')}</button>
        </div>
      ) : (
        <div className="flashcard-actions">
          <button className="btn btn-sm flashcard-btn--got" onClick={() => onJudge('got')}>
            {t('flashcard.gotIt')}
            <span className="flashcard-btn__interval">{previews.got}</span>
          </button>
          <button className="btn btn-sm flashcard-btn--almost" onClick={() => onJudge('almost')}>
            {t('flashcard.almost')}
            <span className="flashcard-btn__interval">{previews.almost}</span>
          </button>
          <button className="btn btn-sm flashcard-btn--missed" onClick={() => onJudge('missed')}>
            {t('flashcard.missedIt')}
            <span className="flashcard-btn__interval">{previews.missed}</span>
          </button>
        </div>
      )}
    </>
  );
}
