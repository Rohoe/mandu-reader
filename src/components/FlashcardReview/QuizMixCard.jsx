import { useMemo, useRef, useCallback } from 'react';
import { useT } from '../../i18n';
import FillBlankMode from './FillBlankMode';
import ListeningMode from './ListeningMode';
import ContextClueMode from './ContextClueMode';
import SentenceBuilderMode from './SentenceBuilderMode';
import ReverseListeningMode from './ReverseListeningMode';
import FlashcardCard from './FlashcardCard';

// No-op — sub-modes call onJudge at reveal time, but in quiz mix
// the parent handles SRS via onComplete when "Next" is clicked.
const noop = () => {};

/**
 * QuizMixCard — picks a random exercise type for a single card.
 * Used inside the Quiz Mix mode of FlashcardReview.
 */
export default function QuizMixCard({
  card,
  direction,
  langId,
  speakText,
  allCards,
  onJudge,
  previousType,
  // FlashcardCard props for fallback
  phase,
  previews,
  romanizationOn,
  romanizer,
  renderRomanization,
  onReveal,
  totalCards,
  cardIdx,
  history,
}) {
  const t = useT();
  const chosenRef = useRef(null);

  // Determine eligible exercise types for this card
  const eligibleTypes = useMemo(() => {
    const types = [];
    const hasExample = card.exampleSentence?.includes(card.target) || card.exampleExtra?.includes(card.target);
    const hasTranslation = !!card.exampleSentenceTranslation && !!card.exampleSentence;

    if (hasExample) types.push('fillblank', 'context');
    if (hasTranslation) types.push('sentence');
    // Listening works for any card via TTS
    types.push('listening');
    // Reverse listening works if card has translation
    if (card.translation) types.push('reverse');

    return types;
  }, [card]);

  // Pick a type, avoiding the previous one if possible
  const exerciseType = useMemo(() => {
    if (eligibleTypes.length === 0) return 'flashcard';

    // Filter out the previous type if we have alternatives
    let candidates = eligibleTypes.filter(t => t !== previousType);
    if (candidates.length === 0) candidates = eligibleTypes;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    chosenRef.current = pick;
    return pick;
  }, [card.target, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by sub-modes when user clicks "Next" after seeing feedback.
  // Triggers the parent's handleJudge to do SRS + session advance.
  const handleComplete = useCallback((judgment) => {
    onJudge(judgment, chosenRef.current);
  }, [onJudge]);

  const typeLabel = {
    fillblank: t('flashcard.fillBlank'),
    listening: t('flashcard.listening'),
    context: t('flashcard.contextClue'),
    sentence: t('flashcard.sentenceBuilder'),
    reverse: t('flashcard.reverseListening'),
    flashcard: t('flashcard.cards'),
  }[exerciseType] || '';

  // Fallback: classic flashcard
  if (exerciseType === 'flashcard') {
    return (
      <>
        <div className="quiz-mix-label text-muted">{typeLabel}</div>
        <FlashcardCard
          currentCard={card}
          currentDirection={direction}
          phase={phase}
          totalCards={totalCards}
          cardIdx={cardIdx}
          previews={previews}
          history={history}
          romanizationOn={romanizationOn}
          romanizer={romanizer}
          renderRomanization={renderRomanization}
          onReveal={onReveal}
          onJudge={onJudge}
          onUndo={() => {}}
        />
      </>
    );
  }

  return (
    <>
      <div className="quiz-mix-label text-muted">{typeLabel}</div>
      {exerciseType === 'fillblank' && (
        <FillBlankMode
          singleCard={card}
          cards={allCards}
          onJudge={noop}
          onComplete={handleComplete}
        />
      )}
      {exerciseType === 'listening' && (
        <ListeningMode
          singleCard={card}
          cards={allCards}
          onJudge={noop}
          onComplete={handleComplete}
          speakText={speakText}
        />
      )}
      {exerciseType === 'context' && (
        <ContextClueMode
          singleCard={card}
          cards={allCards}
          onJudge={noop}
          onComplete={handleComplete}
        />
      )}
      {exerciseType === 'sentence' && (
        <SentenceBuilderMode
          singleCard={card}
          cards={allCards}
          onJudge={noop}
          onComplete={handleComplete}
          langId={langId}
        />
      )}
      {exerciseType === 'reverse' && (
        <ReverseListeningMode
          singleCard={card}
          cards={allCards}
          onJudge={noop}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
