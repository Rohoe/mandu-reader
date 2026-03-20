import { useState, useMemo, useCallback, useEffect } from 'react';
import { useT } from '../../i18n';
import { splitSentence } from './sentenceSplitter';

/**
 * Sentence Builder mode.
 * Shows translation as prompt, scrambled tiles from the target sentence.
 * User taps tiles to reconstruct the original sentence order.
 */
export default function SentenceBuilderMode({ cards, onJudge, onClose, langId }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });

  // Cards where exampleSentence splits into ≥3 tiles
  const eligibleCards = useMemo(() => {
    return cards.map(c => {
      const sentence = c.exampleSentence || '';
      const translation = c.exampleSentenceTranslation || '';
      if (!sentence || !translation) return null;
      const tiles = splitSentence(sentence, langId);
      if (tiles.length < 3) return null;
      return { ...c, tiles, sentenceTranslation: translation };
    }).filter(Boolean);
  }, [cards, langId]);

  const card = eligibleCards[index] || null;
  const done = index >= eligibleCards.length;

  // Scramble the tiles (stable per card)
  const scrambled = useMemo(() => {
    if (!card) return [];
    const indices = card.tiles.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [card, index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Which scrambled indices are still available (not placed)
  const available = useMemo(() => {
    const placedSet = new Set(placed);
    return scrambled.filter(i => !placedSet.has(i));
  }, [scrambled, placed]);

  const handleTapAvailable = useCallback((scrambledIdx) => {
    if (revealed) return;
    setPlaced(prev => [...prev, scrambledIdx]);
  }, [revealed]);

  const handleTapPlaced = useCallback((placedPosition) => {
    if (revealed) return;
    setPlaced(prev => prev.filter((_, i) => i !== placedPosition));
  }, [revealed]);

  const handleCheck = useCallback(() => {
    if (!card || revealed) return;
    setRevealed(true);
    // Check if placed order matches original tile order (0, 1, 2, ...)
    const correct = placed.length === card.tiles.length &&
      placed.every((scrambledIdx, i) => scrambledIdx === i);
    setIsCorrect(correct);
    const judgment = correct ? 'got' : 'missed';
    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
    onJudge(card.target, judgment, 'forward');
  }, [card, placed, revealed, onJudge]);

  const handleNext = useCallback(() => {
    setIndex(i => i + 1);
    setPlaced([]);
    setRevealed(false);
    setIsCorrect(false);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleNext();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [revealed, handleNext, onClose]);

  if (eligibleCards.length === 0) {
    return (
      <div className="quiz-sentence__empty">
        <p className="text-muted">{t('flashcard.noSentenceBuilderCards')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.sentenceBuilderComplete')}</h3>
        <div className="flashcard-done__stats">
          <span className="flashcard-done__stat flashcard-done__stat--got">{t('flashcard.correct', { count: results.correct })}</span>
          <span className="flashcard-done__stat flashcard-done__stat--missed">{t('flashcard.incorrect', { count: results.incorrect })}</span>
        </div>
        <div className="flashcard-done__actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-sentence">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: eligibleCards.length - index })}
        </span>
      </div>

      <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textAlign: 'center' }}>
        {t('flashcard.arrangeTheSentence')}
      </p>

      <div className="quiz-sentence__translation">
        {card.sentenceTranslation}
      </div>

      {/* Answer area — placed tiles */}
      <div className="quiz-sentence__answer" aria-label="Your sentence">
        {placed.length === 0 ? (
          <span className="quiz-sentence__placeholder text-muted">{t('flashcard.tapToPlace')}</span>
        ) : (
          placed.map((tileIdx, i) => (
            <button
              key={`placed-${i}`}
              className={`quiz-sentence__tile quiz-sentence__tile--placed text-target ${
                revealed ? (tileIdx === i ? 'quiz-sentence__tile--correct' : 'quiz-sentence__tile--incorrect') : ''
              }`}
              onClick={() => handleTapPlaced(i)}
              disabled={revealed}
            >
              {card.tiles[tileIdx]}
            </button>
          ))
        )}
      </div>

      {/* Available tiles — scrambled */}
      {!revealed && (
        <div className="quiz-sentence__tiles" aria-label="Available tiles">
          {available.map((tileIdx) => (
            <button
              key={`avail-${tileIdx}`}
              className="quiz-sentence__tile text-target"
              onClick={() => handleTapAvailable(tileIdx)}
            >
              {card.tiles[tileIdx]}
            </button>
          ))}
        </div>
      )}

      {/* Check / feedback */}
      {!revealed && placed.length === card.tiles.length && (
        <button className="btn btn-secondary btn-sm" onClick={handleCheck}>{t('common.check')}</button>
      )}

      {revealed && (
        <div className="quiz-sentence__feedback">
          {isCorrect ? (
            <span className="quiz-fillblank__correct">{t('flashcard.sentenceCorrect')}</span>
          ) : (
            <div className="quiz-sentence__correct-answer">
              <span className="quiz-fillblank__incorrect">{t('common.answer')}</span>
              <span className="quiz-sentence__original text-target">{card.exampleSentence}</span>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleNext}>{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
