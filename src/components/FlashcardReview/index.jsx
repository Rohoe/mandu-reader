import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../context/useAppSelector';
import { actions } from '../../context/actions';
import { getAllLanguages, getLang } from '../../lib/languages';
import { useRomanization } from '../../hooks/useRomanization';
import { useTTS } from '../../hooks/useTTS';
import { useT } from '../../i18n';
import { useMasteryStats } from './useMasteryStats';
import { useFlashcardSession } from '../../hooks/useFlashcardSession';
import FlashcardDoneScreen from './FlashcardDoneScreen';
import FlashcardCard from './FlashcardCard';
import ModePicker from './ModePicker';
import QuizMixCard from './QuizMixCard';
import FillBlankMode from './FillBlankMode';
import ListeningMode from './ListeningMode';
import MatchingMode from './MatchingMode';
import SentenceBuilderMode from './SentenceBuilderMode';
import ContextClueMode from './ContextClueMode';
import ReverseListeningMode from './ReverseListeningMode';
import GrammarReviewMode from './GrammarReviewMode';
import './FlashcardReview.css';

// Map initialMode values to reviewMode values
function resolveInitialMode(initialMode) {
  if (!initialMode) return 'pick';
  if (initialMode === 'flashcard') return 'srs';
  if (initialMode === 'quizmix') return 'quizmix';
  if (initialMode === 'grammar') return 'grammar';
  // Specific exercise types pass through
  return initialMode;
}

const STANDALONE_MODES = new Set(['fillblank', 'listening', 'matching', 'sentence', 'context', 'reverse']);

export default function FlashcardReview({ onClose, initialLangId, initialMode, vocabFilter }) {
  const t = useT();
  const { learnedVocabulary, learnedGrammar, newCardsPerDay, romanizationOn } = useAppSelector(s => ({
    learnedVocabulary: s.learnedVocabulary,
    learnedGrammar: s.learnedGrammar,
    newCardsPerDay: s.newCardsPerDay,
    romanizationOn: s.romanizationOn,
  }));
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const languages = getAllLanguages();

  // Detect which languages have vocab or grammar
  const availableLangs = useMemo(() => {
    const langIds = new Set(
      Object.values(learnedVocabulary).map(d => d.langId || 'zh')
    );
    for (const g of Object.values(learnedGrammar || {})) {
      if (g.langId) langIds.add(g.langId);
    }
    return languages.filter(l => langIds.has(l.id));
  }, [learnedVocabulary, learnedGrammar, languages]);

  const [langFilter, setLangFilter] = useState(() => {
    if (initialLangId && availableLangs.some(l => l.id === initialLangId)) return initialLangId;
    return availableLangs.length > 0 ? availableLangs[0].id : 'zh';
  });

  // reviewMode: 'pick' | 'srs' | 'quizmix' | 'fillblank' | 'listening' | 'matching' | 'sentence' | 'context' | 'reverse'
  const [reviewMode, setReviewMode] = useState(() => resolveInitialMode(initialMode));

  // Romanization for flashcard front
  const langConfig = getLang(langFilter);
  const { renderChars: renderRomanization, romanizer } = useRomanization(langFilter, langConfig, romanizationOn);

  // TTS for listening mode
  const { ttsVoiceURIs, ttsSpeechRate } = useAppSelector(s => ({
    ttsVoiceURIs: s.ttsVoiceURIs, ttsSpeechRate: s.ttsSpeechRate,
  }));
  const { speakText } = useTTS({
    langConfig, langId: langFilter,
    voiceURIs: ttsVoiceURIs,
    setTtsVoice: (lid, uri) => act.setTtsVoiceForLang(lid, uri),
    speechRate: ttsSpeechRate,
  });

  // Build card list from learnedVocabulary
  const allCards = useMemo(() => {
    return Object.entries(learnedVocabulary).map(([word, data]) => ({
      target: word,
      romanization: data.romanization || data.pinyin || '',
      translation: data.translation || data.english || '',
      langId: data.langId || 'zh',
      exampleSentence: data.exampleSentence || '',
      exampleSentenceTranslation: data.exampleSentenceTranslation || '',
      exampleExtra: data.exampleExtra || '',
      exampleExtraTranslation: data.exampleExtraTranslation || '',
      // Forward SRS fields
      interval: data.interval ?? 0,
      ease: data.ease ?? 2.5,
      nextReview: data.nextReview ?? null,
      reviewCount: data.reviewCount ?? 0,
      lapses: data.lapses ?? 0,
      // Reverse SRS fields
      reverseInterval: data.reverseInterval ?? 0,
      reverseEase: data.reverseEase ?? 2.5,
      reverseNextReview: data.reverseNextReview ?? null,
      reverseReviewCount: data.reverseReviewCount ?? 0,
      reverseLapses: data.reverseLapses ?? 0,
    }));
  }, [learnedVocabulary]);

  const langCards = useMemo(() => {
    const filtered = allCards.filter(c => c.langId === langFilter);
    if (vocabFilter?.length > 0) {
      const filterSet = new Set(vocabFilter);
      filtered.sort((a, b) => {
        const aMatch = filterSet.has(a.target) ? 0 : 1;
        const bMatch = filterSet.has(b.target) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return filtered;
  }, [allCards, langFilter, vocabFilter]);

  // Build grammar card list
  const grammarCards = useMemo(() =>
    Object.entries(learnedGrammar || {}).map(([compositeKey, data]) => ({
      compositeKey,
      pattern: data.pattern,
      label: data.label || '',
      explanation: data.explanation || '',
      example: data.example || '',
      langId: data.langId,
      interval: data.interval ?? 0,
      ease: data.ease ?? 2.5,
      nextReview: data.nextReview ?? null,
      reviewCount: data.reviewCount ?? 0,
      lapses: data.lapses ?? 0,
    })),
  [learnedGrammar]);

  const langGrammarCards = useMemo(() =>
    grammarCards.filter(c => c.langId === langFilter),
  [grammarCards, langFilter]);

  // Grammar due/new counts
  const { grammarDueCount, grammarNewCount, grammarTotal } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowMs = now.getTime();
    let due = 0, nc = 0;
    for (const card of langGrammarCards) {
      const rc = card.reviewCount ?? 0;
      const nr = card.nextReview ? new Date(card.nextReview).getTime() : null;
      if (rc === 0 && !nr) nc++;
      else if (!nr || nr <= nowMs) due++;
    }
    return { grammarDueCount: due, grammarNewCount: nc, grammarTotal: langGrammarCards.length };
  }, [langGrammarCards]);

  // Session management (extracted to hook)
  const {
    session, phase, setPhase, history,
    currentCard, currentCardKey, currentDirection,
    totalCards, cardIdx,
    dueCount, newCount, previews,
    handleReveal, handleJudge, handleUndo,
    handleNextSession, handleNewSession, handleQuizJudge,
    hasMoreCards, lastExerciseTypeRef,
  } = useFlashcardSession({ langCards, langFilter, newCardsPerDay, act });

  // Mode picker handler
  const handleSelectMode = useCallback((mode) => {
    setReviewMode(mode);
    // Reset phase when entering SRS/quizmix/grammar from picker
    if (mode === 'srs' || mode === 'quizmix') {
      if (session.index < session.cardKeys.length) {
        setPhase('front');
      }
    }
  }, [session]);

  const handleBackToModes = useCallback(() => {
    setReviewMode('pick');
  }, []);

  // Close on Escape, keyboard navigation for flashcards
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose?.(); return; }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && history.length > 0) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Only handle keyboard for SRS and quizmix modes (not standalone exercises or grammar — grammar handles its own)
      if (reviewMode !== 'srs' && reviewMode !== 'quizmix') return;

      if (phase === 'front' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleReveal();
      } else if (phase === 'back' && reviewMode === 'srs') {
        if (e.key === '1') handleJudge('got');
        else if (e.key === '2') handleJudge('almost');
        else if (e.key === '3') handleJudge('missed');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, phase, reviewMode, handleReveal, handleJudge, handleUndo, history.length]);

  // Mastery stats for done screen
  const masteryStats = useMasteryStats(langCards);

  if (allCards.length === 0 && grammarCards.length === 0) {
    return (
      <div className="modal-overlay flashcard-overlay" role="dialog" aria-modal="true" aria-label="Flashcard review" onClick={e => e.target === e.currentTarget && onClose?.()}>
        <div className="flashcard-modal card card-padded fade-in">
          <div className="flashcard-modal__header">
            <h2 className="font-display flashcard-modal__title">{t('flashcard.title')}</h2>
            <button className="btn btn-ghost btn-sm flashcard-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
            {t('flashcard.noVocab')}
          </p>
        </div>
      </div>
    );
  }

  const isSrsOrQuizMix = reviewMode === 'srs' || reviewMode === 'quizmix';
  const isStandaloneExercise = STANDALONE_MODES.has(reviewMode);
  const showSessionDone = isSrsOrQuizMix && (totalCards === 0 || (phase !== 'done' && cardIdx >= totalCards) || phase === 'done');

  return (
    <div className="modal-overlay flashcard-overlay" role="dialog" aria-modal="true" aria-label="Flashcard review" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="flashcard-modal card card-padded fade-in">
        <div className="flashcard-modal__header">
          {reviewMode !== 'pick' && (
            <button className="btn btn-ghost btn-sm flashcard-modal__back" onClick={handleBackToModes} aria-label={t('flashcard.backToModes')}>
              ← {t('flashcard.backToModes')}
            </button>
          )}
          {reviewMode === 'pick' && (
            <h2 className="font-display flashcard-modal__title">{t('flashcard.title')}</h2>
          )}
          <button className="btn btn-ghost btn-sm flashcard-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Language filter pills */}
        {availableLangs.length > 1 && (
          <div className="pill-selector flashcard-lang-pills">
            {availableLangs.map(l => (
              <button
                key={l.id}
                className={`pill-option flashcard-lang-pill ${langFilter === l.id ? 'active' : ''}`}
                onClick={() => setLangFilter(l.id)}
              >
                {l.nameNative}
              </button>
            ))}
          </div>
        )}

        {/* ── Mode Picker ─────────────────────────────────── */}
        {reviewMode === 'pick' && (
          <ModePicker
            dueCount={dueCount}
            newCount={newCount}
            langCards={langCards}
            langId={langFilter}
            onSelectMode={handleSelectMode}
            grammarDueCount={grammarDueCount}
            grammarNewCount={grammarNewCount}
            grammarTotal={grammarTotal}
          />
        )}

        {/* ── Standalone exercise modes ───────────────────── */}
        {reviewMode === 'fillblank' && (
          <FillBlankMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} />
        )}
        {reviewMode === 'listening' && (
          <ListeningMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} speakText={speakText} />
        )}
        {reviewMode === 'matching' && (
          <MatchingMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} />
        )}
        {reviewMode === 'sentence' && (
          <SentenceBuilderMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} langId={langFilter} />
        )}
        {reviewMode === 'context' && (
          <ContextClueMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} />
        )}
        {reviewMode === 'reverse' && (
          <ReverseListeningMode cards={langCards} onJudge={handleQuizJudge} onClose={onClose} />
        )}

        {/* ── Grammar Review mode ────────────────────────── */}
        {reviewMode === 'grammar' && (
          <GrammarReviewMode
            cards={langGrammarCards}
            langId={langFilter}
            newCardsPerDay={newCardsPerDay}
            act={act}
            onClose={onClose}
            onBack={handleBackToModes}
          />
        )}

        {/* ── SRS / Quiz Mix session stats ────────────────── */}
        {isSrsOrQuizMix && !showSessionDone && (
          <div className="flashcard-session-stats">
            <span className="flashcard-stat-badge flashcard-stat-badge--due">{t('flashcard.due', { count: dueCount })}</span>
            <span className="flashcard-stat-badge flashcard-stat-badge--new">{t('flashcard.new', { count: newCount })}</span>
            <span className="flashcard-stat-badge flashcard-stat-badge--total">{t('flashcard.total', { count: langCards.length })}</span>
            {availableLangs.length === 1 && <span className="flashcard-stat-badge">{availableLangs[0].nameNative}</span>}
          </div>
        )}

        {/* ── SRS / Quiz Mix done screen ──────────────────── */}
        {showSessionDone && (
          <FlashcardDoneScreen
            phase={phase}
            totalCards={totalCards}
            cardIdx={cardIdx}
            session={session}
            masteryStats={masteryStats}
            history={history}
            hasMoreCards={hasMoreCards}
            onUndo={handleUndo}
            onNextSession={handleNextSession}
            onNewSession={handleNewSession}
            onClose={onClose}
          />
        )}

        {/* ── SRS Review mode (classic flip cards) ────────── */}
        {reviewMode === 'srs' && !showSessionDone && (
          <FlashcardCard
            currentCard={currentCard}
            currentDirection={currentDirection}
            phase={phase}
            totalCards={totalCards}
            cardIdx={cardIdx}
            previews={previews}
            history={history}
            romanizationOn={romanizationOn}
            romanizer={romanizer}
            renderRomanization={renderRomanization}
            onReveal={handleReveal}
            onJudge={handleJudge}
            onUndo={handleUndo}
          />
        )}

        {/* ── Quiz Mix mode ───────────────────────────────── */}
        {reviewMode === 'quizmix' && !showSessionDone && currentCard && (
          <QuizMixCard
            key={`${currentCard.target}-${cardIdx}`}
            card={currentCard}
            direction={currentDirection}
            langId={langFilter}
            speakText={speakText}
            allCards={langCards}
            onJudge={handleJudge}
            previousType={lastExerciseTypeRef.current}
            phase={phase}
            previews={previews}
            romanizationOn={romanizationOn}
            romanizer={romanizer}
            renderRomanization={renderRomanization}
            onReveal={handleReveal}
            totalCards={totalCards}
            cardIdx={cardIdx}
            history={history}
          />
        )}
      </div>
    </div>
  );
}
