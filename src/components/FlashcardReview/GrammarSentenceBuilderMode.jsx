import { useState, useMemo, useCallback, useEffect } from 'react';
import { useT } from '../../i18n';
import { splitSentence } from './sentenceSplitter';
import { calculateSRS } from './srs';

/**
 * Fisher-Yates shuffle (returns a new array).
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * GrammarSentenceBuilderMode — arrange tiles to build a sentence using the grammar pattern.
 * User sees the pattern + explanation, then arranges shuffled tiles from the example sentence.
 */
export default function GrammarSentenceBuilderMode({ cards, session, langId, act, onSessionUpdate }) {
  const t = useT();

  // Filter to cards with splittable examples (3+ tiles)
  const eligibleCards = useMemo(() => {
    return cards
      .filter(c => {
        if (!c.example) return false;
        const tiles = splitSentence(c.example, langId);
        return tiles.length >= 3;
      })
      .map(c => ({
        ...c,
        tiles: splitSentence(c.example, langId),
      }));
  }, [cards, langId]);

  const [index, setIndex] = useState(0);
  const [scrambled, setScrambled] = useState(() => {
    if (eligibleCards.length === 0) return [];
    return shuffle(eligibleCards[0].tiles.map((t, i) => i));
  });
  const [placed, setPlaced] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });

  const current = eligibleCards[index] || null;

  // Re-scramble when index changes
  useEffect(() => {
    if (!eligibleCards[index]) return;
    setScrambled(shuffle(eligibleCards[index].tiles.map((_, i) => i)));
    setPlaced([]);
    setRevealed(false);
    setIsCorrect(false);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTileClick = useCallback((scrambledIdx) => {
    if (revealed) return;
    if (placed.includes(scrambledIdx)) {
      // Remove from placed
      setPlaced(prev => prev.filter(i => i !== scrambledIdx));
    } else {
      setPlaced(prev => [...prev, scrambledIdx]);
    }
  }, [placed, revealed]);

  const handleCheck = useCallback(() => {
    if (!current || revealed) return;
    // Correct if placed order matches original order (0, 1, 2, ...)
    const correct = placed.every((scrambledIdx, i) => scrambledIdx === i);
    setIsCorrect(correct);
    setRevealed(true);

    const judgment = correct ? 'got' : 'missed';
    const srsUpdate = calculateSRS(judgment, current, 'forward');
    act.updateGrammarSRS(current.target, srsUpdate);
    act.logActivity('flashcard_reviewed', { word: current.pattern, judgment, direction: 'grammar_build' });
    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
  }, [current, placed, revealed, act]);

  const handleNext = useCallback(() => {
    if (index + 1 >= eligibleCards.length) {
      onSessionUpdate({ ...session, index: session.cardKeys.length }, 'done');
      return;
    }
    setIndex(i => i + 1);
  }, [index, eligibleCards.length, session, onSessionUpdate]);

  // Keyboard: Enter to check or advance
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (revealed) handleNext();
        else if (placed.length === current?.tiles.length) handleCheck();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [revealed, placed, current, handleNext, handleCheck]);

  if (eligibleCards.length === 0) {
    return (
      <div className="flashcard-done" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
        <p className="text-muted">{t('grammar.noEligible')}</p>
        <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{t('grammar.tryClassic')}</p>
      </div>
    );
  }

  if (index >= eligibleCards.length) {
    return (
      <div className="flashcard-done" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
        <p>{results.correct} / {results.correct + results.incorrect} {t('common.correct').replace('!', '')}</p>
      </div>
    );
  }

  const allPlaced = placed.length === current.tiles.length;
  const placedSet = new Set(placed);

  return (
    <div className="sentence-builder" style={{ padding: 'var(--space-4) 0' }}>
      <div className="flashcard-progress text-muted" style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        {index + 1} / {eligibleCards.length}
      </div>

      <p className="text-muted" style={{ textAlign: 'center', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
        {t('grammar.buildPrompt')}
      </p>

      <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.1rem', marginBottom: 'var(--space-1)' }}>
        {current.pattern}
      </p>
      {current.explanation && (
        <p className="text-muted" style={{ textAlign: 'center', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
          {current.explanation}
        </p>
      )}

      {/* Placed tiles area */}
      <div className="sentence-builder__placed" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', justifyContent: 'center', minHeight: 40, marginBottom: 'var(--space-3)', padding: 'var(--space-2)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)' }}>
        {placed.map((origIdx, i) => (
          <button
            key={i}
            className="sentence-builder__tile sentence-builder__tile--placed"
            onClick={() => handleTileClick(origIdx)}
          >
            {current.tiles[origIdx]}
          </button>
        ))}
      </div>

      {/* Available tiles */}
      <div className="sentence-builder__tiles" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
        {scrambled.map((origIdx) => (
          <button
            key={origIdx}
            className={`sentence-builder__tile ${placedSet.has(origIdx) ? 'sentence-builder__tile--used' : ''}`}
            onClick={() => handleTileClick(origIdx)}
            disabled={placedSet.has(origIdx) || revealed}
          >
            {current.tiles[origIdx]}
          </button>
        ))}
      </div>

      {/* Check / result */}
      {!revealed && allPlaced && (
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleCheck}>{t('common.check')}</button>
        </div>
      )}

      {revealed && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
          <p style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
            {isCorrect ? t('common.correct') : t('grammar.correctAnswer', { answer: current.example })}
          </p>
          <button className="btn btn-sm" onClick={handleNext} style={{ marginTop: 'var(--space-2)' }}>
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
