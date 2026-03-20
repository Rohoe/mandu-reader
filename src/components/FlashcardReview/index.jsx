import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../../context/useAppSelector';
import { actions } from '../../context/actions';
import { getAllLanguages, getLang } from '../../lib/languages';
import { loadFlashcardSession, saveFlashcardSession } from '../../lib/storage';
import { useRomanization } from '../../hooks/useRomanization';
import { useTTS } from '../../hooks/useTTS';
import { useT } from '../../i18n';
import { calculateSRS, buildDailySession } from './srs';
import { useMasteryStats } from './useMasteryStats';
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
import './FlashcardReview.css';

function formatInterval(days) {
  if (days <= 0) return '<1d';
  if (days < 14) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

// Map initialMode values to reviewMode values
function resolveInitialMode(initialMode) {
  if (!initialMode) return 'pick';
  if (initialMode === 'flashcard') return 'srs';
  if (initialMode === 'quizmix') return 'quizmix';
  // Specific exercise types pass through
  return initialMode;
}

const STANDALONE_MODES = new Set(['fillblank', 'listening', 'matching', 'sentence', 'context', 'reverse']);

export default function FlashcardReview({ onClose, initialLangId, initialMode, vocabFilter }) {
  const t = useT();
  const { learnedVocabulary, newCardsPerDay, romanizationOn } = useAppSelector(s => ({
    learnedVocabulary: s.learnedVocabulary,
    newCardsPerDay: s.newCardsPerDay,
    romanizationOn: s.romanizationOn,
  }));
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const languages = getAllLanguages();

  // Detect which languages have vocab
  const availableLangs = useMemo(() => {
    const langIds = new Set(
      Object.values(learnedVocabulary).map(d => d.langId || 'zh')
    );
    return languages.filter(l => langIds.has(l.id));
  }, [learnedVocabulary, languages]);

  const [langFilter, setLangFilter] = useState(() => {
    if (initialLangId && availableLangs.some(l => l.id === initialLangId)) return initialLangId;
    return availableLangs.length > 0 ? availableLangs[0].id : 'zh';
  });

  // reviewMode: 'pick' | 'srs' | 'quizmix' | 'fillblank' | 'listening' | 'matching' | 'sentence' | 'context' | 'reverse'
  const [reviewMode, setReviewMode] = useState(() => resolveInitialMode(initialMode));

  // Track the last exercise type used in quiz mix to avoid repeats
  const lastExerciseTypeRef = useRef(null);

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

  // Session management (per-language persistence)
  const [session, setSession] = useState(() => {
    const saved = loadFlashcardSession(langFilter);
    return buildDailySession(langCards, newCardsPerDay, saved, langFilter);
  });

  // Rebuild session when language filter changes
  useEffect(() => {
    const saved = loadFlashcardSession(langFilter);
    const newSession = buildDailySession(langCards, newCardsPerDay, saved, langFilter);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.index >= newSession.cardKeys.length ? 'done' : 'front');
  }, [langFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session to localStorage on change (per-language key)
  useEffect(() => {
    saveFlashcardSession(session, session.langId);
  }, [session]);

  // State machine: 'front' | 'back' | 'done'
  const [phase, setPhase] = useState(() =>
    session.index >= session.cardKeys.length ? 'done' : 'front'
  );
  const [history, setHistory] = useState([]);

  // Current card data
  const currentCardKey = session.cardKeys[session.index] || null;
  const currentDirection = session.cardDirections[session.index] || 'forward';
  const currentCard = useMemo(() => {
    if (!currentCardKey) return null;
    return langCards.find(c => c.target === currentCardKey) || null;
  }, [currentCardKey, langCards]);

  const totalCards = session.cardKeys.length;
  const cardIdx = session.index;

  // Count due and new for display
  const { dueCount, newCount } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowMs = now.getTime();
    let due = 0, nc = 0;
    for (const card of langCards) {
      const rc = card.reviewCount ?? 0;
      const nr = card.nextReview ? new Date(card.nextReview).getTime() : null;
      if (rc === 0 && !nr) nc++;
      else if (!nr || nr <= nowMs) due++;
    }
    return { dueCount: due, newCount: nc };
  }, [langCards]);

  // SRS interval previews for judgment buttons
  const previews = useMemo(() => {
    if (!currentCard) return {};
    return {
      got:    formatInterval(Object.values(calculateSRS('got', currentCard, currentDirection))[0]),
      almost: formatInterval(Object.values(calculateSRS('almost', currentCard, currentDirection))[0]),
      missed: formatInterval(Object.values(calculateSRS('missed', currentCard, currentDirection))[0]),
    };
  }, [currentCard, currentDirection]);

  const handleReveal = useCallback(() => setPhase('back'), []);

  const handleJudge = useCallback((judgment, exerciseType) => {
    if (!currentCard) return;

    const direction = currentDirection;
    const prefix = direction === 'reverse' ? 'reverse' : '';
    const key = (field) => prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;

    const wasRequeued = judgment !== 'got';

    // Save snapshot for undo
    setHistory(prev => [...prev, {
      word: currentCard.target,
      judgment,
      direction,
      exerciseType: exerciseType || null,
      wasRequeued,
      previousSRS: {
        [key('interval')]: currentCard[key('interval')],
        [key('ease')]: currentCard[key('ease')],
        [key('nextReview')]: currentCard[key('nextReview')],
        [key('reviewCount')]: currentCard[key('reviewCount')],
        [key('lapses')]: currentCard[key('lapses')],
      },
      previousSessionIndex: session.index,
      previousResults: { ...session.results },
    }]);

    act.logActivity('flashcard_reviewed', { word: currentCard.target, judgment, direction });

    // Calculate and persist SRS update
    const srsUpdate = calculateSRS(judgment, currentCard, direction);
    act.updateVocabSRS(currentCard.target, srsUpdate);

    // Track exercise type for quiz mix variety
    if (exerciseType) lastExerciseTypeRef.current = exerciseType;

    const newResults = { ...session.results, [judgment]: session.results[judgment] + 1 };
    const newIndex = session.index + 1;

    setSession(prev => {
      const updated = { ...prev, index: newIndex, results: newResults };
      // Re-queue missed/almost cards at the end
      if (wasRequeued) {
        updated.cardKeys = [...prev.cardKeys, currentCardKey];
        updated.cardDirections = [...prev.cardDirections, currentDirection];
      }
      return updated;
    });

    if (newIndex >= totalCards + (wasRequeued ? 1 : 0)) {
      setPhase('done');
    } else {
      setPhase('front');
    }
  }, [cardIdx, totalCards, currentCard, currentCardKey, currentDirection, session, act]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    // Restore SRS
    act.updateVocabSRS(last.word, last.previousSRS);

    // Restore session state
    setSession(prev => {
      const updated = {
        ...prev,
        index: last.previousSessionIndex,
        results: last.previousResults,
      };
      // Remove the re-queued card from the end
      if (last.wasRequeued) {
        updated.cardKeys = prev.cardKeys.slice(0, -1);
        updated.cardDirections = prev.cardDirections.slice(0, -1);
      }
      return updated;
    });

    setPhase('back');
  }, [history, act]);

  const handleNextSession = useCallback(() => {
    const newSession = buildDailySession(langCards, newCardsPerDay, session, langFilter);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [langCards, newCardsPerDay, session, langFilter]);

  const handleNewSession = useCallback(() => {
    const newSession = buildDailySession(langCards, newCardsPerDay, null, langFilter, { newOnly: true });
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [langCards, newCardsPerDay, langFilter]);

  // Handler for standalone quiz mode sub-components
  const handleQuizJudge = useCallback((word, judgment, direction) => {
    act.logActivity('flashcard_reviewed', { word, judgment, direction });
    const card = langCards.find(c => c.target === word);
    if (card) {
      const srsUpdate = calculateSRS(judgment, card, direction);
      act.updateVocabSRS(word, srsUpdate);
    }
  }, [langCards, act]);

  // Mode picker handler
  const handleSelectMode = useCallback((mode) => {
    setReviewMode(mode);
    // Reset phase when entering SRS/quizmix from picker
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

      // Only handle keyboard for SRS and quizmix modes (not standalone exercises)
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

  // Check if more cards are available beyond this session
  const hasMoreCards = useMemo(() => {
    const testSession = buildDailySession(langCards, newCardsPerDay, session, langFilter);
    return testSession.cardKeys.length > 0 && testSession.index < testSession.cardKeys.length;
  }, [langCards, newCardsPerDay, session, langFilter]);

  if (allCards.length === 0) {
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
