import { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../context/useAppSelector';
import { AppContext } from '../../context/AppContext';
import { actions } from '../../context/actions';
import { LOAD_CACHED_READER, SET_QUOTA_WARNING } from '../../context/actionTypes';
import { getLang, DEFAULT_LANG_ID } from '../../lib/languages';
import { buildLLMConfig } from '../../lib/llmConfig';
import { translateText } from '../../lib/translate';
import { getNextActions } from '../../lib/nextActions';
import { useT } from '../../i18n';
import NextActionSuggestion from '../NextActionSuggestion';
import { useTTS } from '../../hooks/useTTS';
import { useRomanization } from '../../hooks/useRomanization';
import { useVocabPopover } from '../../hooks/useVocabPopover';
import { useReaderGeneration } from '../../hooks/useReaderGeneration';
import { useTextSelection } from '../../hooks/useTextSelection';
import { useSentenceTranslate } from '../../hooks/useSentenceTranslate';
import { useReadingTimer } from '../../hooks/useReadingTimer';
import { DEMO_READER_KEYS } from '../../lib/demoReader';
import StorySection from '../StorySection';
import VocabularyList from '../VocabularyList';
import ComprehensionQuestions from '../ComprehensionQuestions';
import AnkiExportButton from '../AnkiExportButton';
import GrammarNotes from '../GrammarNotes';
import AccuracyNotes from './AccuracyNotes';
import ReaderHeader from '../ReaderHeader';
import ReaderActions from '../ReaderActions';
import ReaderEmptyState from './ReaderEmptyState';
import ReaderErrorState from './ReaderErrorState';
import ReaderStreamingPreview from './ReaderStreamingPreview';
import ReaderGeneratingState from './ReaderGeneratingState';
import ReaderEvictedState from './ReaderEvictedState';
import ReaderPregenerate from './ReaderPregenerate';
import ChatSummary from '../TutorChat/ChatSummary';
import { AlertTriangle, X } from 'lucide-react';
import { useScrollProgress } from '../../hooks/useScrollProgress';
import ReadingProgressBar from './ReadingProgressBar';
import { ReaderProvider } from '../../context/ReaderContext';
import './ReaderView.css';

export default function ReaderView({ lessonKey, lessonMeta, syllabus, onMarkComplete, onUnmarkComplete, isCompleted, onContinueStory, onOpenSidebar, onOpenSettings, onOpenChat, onArchive, onDelete, onShowFlashcards, onShowNewForm, onSelectLesson }) {
  const t = useT();
  // Track which lesson keys we've already tried to load from cache
  const loadedKeysRef = useRef(new Set());
  // Split selectors to prevent settings changes from re-rendering reader content
  const { generatedReaders, learnedVocabulary, learningActivity, error, pendingReaders, evictedReaderKeys, quotaWarning } = useAppSelector(s => ({
    generatedReaders: s.generatedReaders, learnedVocabulary: s.learnedVocabulary, learningActivity: s.learningActivity, error: s.error,
    pendingReaders: s.pendingReaders, evictedReaderKeys: s.evictedReaderKeys, quotaWarning: s.quotaWarning,
  }));
  const { ttsVoiceURIs, ttsSpeechRate, romanizationOn, translateButtons } = useAppSelector(s => ({
    ttsVoiceURIs: s.ttsVoiceURIs, ttsSpeechRate: s.ttsSpeechRate,
    romanizationOn: s.romanizationOn, translateButtons: s.translateButtons,
  }));
  const { providerKeys, activeProvider, activeModels, customBaseUrl, maxTokens, useStructuredOutput, nativeLang, immersionMode, difficultyFeedback } = useAppSelector(s => ({
    providerKeys: s.providerKeys, activeProvider: s.activeProvider, activeModels: s.activeModels, customBaseUrl: s.customBaseUrl,
    maxTokens: s.maxTokens, useStructuredOutput: s.useStructuredOutput, nativeLang: s.nativeLang || 'en',
    immersionMode: s.immersionMode || 'auto', difficultyFeedback: s.difficultyFeedback,
  }));
  const dispatch = useAppDispatch();
  const { restoreEvictedReader } = useContext(AppContext);
  const act = useMemo(() => actions(dispatch), [dispatch]);
  const isPending = !!(lessonKey && pendingReaders[lessonKey]);

  const { standaloneReaders, syllabi, syllabusProgress, learnedGrammar } = useAppSelector(s => ({
    standaloneReaders: s.standaloneReaders,
    syllabi: s.syllabi,
    syllabusProgress: s.syllabusProgress,
    learnedGrammar: s.learnedGrammar,
  }));
  const postLessonActions = useMemo(() => {
    if (!isCompleted) return [];
    return getNextActions({ learnedVocabulary, learnedGrammar, syllabi, syllabusProgress, standaloneReaders, generatedReaders, learningActivity }, { context: 'post-lesson', maxResults: 2 });
  }, [isCompleted, learnedVocabulary, learnedGrammar, syllabi, syllabusProgress, standaloneReaders, generatedReaders, learningActivity]);
  const reader = generatedReaders[lessonKey];
  // For plan activities: reader metadata lives in standaloneReaders, not generatedReaders
  const standaloneMeta = (!reader && !lessonMeta && lessonKey)
    ? standaloneReaders.find(r => r.key === lessonKey)
    : null;
  const isDemo = DEMO_READER_KEYS.has(lessonKey);
  const scrollRef = useRef(null);
  const { progress: scrollProgress } = useScrollProgress(scrollRef);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [nativeLangTipDismissed, setNativeLangTipDismissed] = useState(
    () => localStorage.getItem('gradedReader_nativeLangTipDismissed') === '1'
  );
  const [readerLength, setReaderLength] = useState(1200);
  const [translatingIndex, setTranslatingIndex] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [translatingVocabKey, setTranslatingVocabKey] = useState(null);

  // Determine langId from reader, lessonMeta, or syllabus
  const langId = reader?.langId || lessonMeta?.langId || DEFAULT_LANG_ID;
  const langConfig = getLang(langId);

  // Set data-lang on <html> and update page title when reader changes
  useEffect(() => {
    document.documentElement.setAttribute('data-lang', langId);
    const titles = { zh: 'Mandu — Mandarin Reader', yue: 'Mandu — Cantonese Reader', ko: 'Mandu — Korean Reader', fr: 'Mandu — French Reader', es: 'Mandu — Spanish Reader', en: 'Mandu — English Reader' };
    document.title = titles[langId] || 'Mandu — Graded Reader';
    return () => {
      document.documentElement.removeAttribute('data-lang');
      document.title = 'Mandu — Graded Reader';
    };
  }, [langId]);

  // Cycling chars for empty state
  const decorativeChars = langConfig.decorativeChars;
  const [charIndex, setCharIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCharIndex(i => (i + 1) % decorativeChars.length), 2000);
    return () => clearInterval(id);
  }, [decorativeChars.length]);

  // ── Custom hooks ─────────────────────────────────────────────
  const { ttsSupported, speakingKey, speakText, stopSpeaking } = useTTS({
    langConfig, langId,
    voiceURIs: ttsVoiceURIs,
    setTtsVoice: (lid, uri) => act.setTtsVoiceForLang(lid, uri),
    speechRate: ttsSpeechRate,
  });

  const { pinyinOn, romanizer, renderChars } = useRomanization(langId, langConfig, romanizationOn);

  const { activeVocab, setActiveVocab, popoverRef, handleVocabClick, lookupVocab, getPopoverPosition } = useVocabPopover(reader, langConfig);

  const { selection, popoverRef: selectionPopoverRef, clearSelection } = useTextSelection(scrollRef);
  const [selectionPopover, setSelectionPopover] = useState(null);

  const { sentencePopover, highlightedSentence, sentencePopoverRef, handleWordClick, handleSentenceEndClick, closeSentencePopover } = useSentenceTranslate(langId, nativeLang);

  // Track reading time for this lesson
  useReadingTimer(reader ? lessonKey : null);

  // Build selection popover data when selection changes
  useEffect(() => {
    if (!selection) {
      setSelectionPopover(null);
      return;
    }
    // If vocab popover is active, don't show selection popover
    if (activeVocab) {
      setSelectionPopover(null);
      return;
    }

    const { text, rect } = selection;
    // Don't show popover for pure English / non-target-script selections
    if (langConfig.scriptRegex && !langConfig.scriptRegex.test(text)) {
      setSelectionPopover(null);
      return;
    }
    let romanization = null;
    if (romanizer) {
      try {
        const romArr = romanizer.romanize(text);
        romanization = romArr.join('');
      } catch { /* ignore */ }
    }

    setSelectionPopover({ text, rect, romanization, translation: null });

    // Fetch translation async
    let cancelled = false;
    translateText(text, langId, { to: nativeLang === 'en' ? 'en' : nativeLang }).then(translation => {
      if (!cancelled) {
        setSelectionPopover(prev => prev ? { ...prev, translation } : null);
      }
    }).catch((err) => {
      if (!cancelled) {
        setSelectionPopover(prev => prev ? { ...prev, translation: t('notify.translationFailed', { error: err?.message || '' }) } : null);
      }
    });
    return () => { cancelled = true; };
  }, [selection, activeVocab, romanizer, langId]);

  // Close selection popover when vocab popover opens
  useEffect(() => {
    if (activeVocab) {
      clearSelection();
      closeSentencePopover();
    }
  }, [activeVocab, clearSelection, closeSentencePopover]);

  // Close sentence popover when selection popover opens
  useEffect(() => {
    if (selectionPopover) closeSentencePopover();
  }, [selectionPopover, closeSentencePopover]);

  const llmConfig = buildLLMConfig({ providerKeys, activeProvider, activeModels, customBaseUrl });
  const { handleGenerate, streamingText } = useReaderGeneration({
    lessonKey, lessonMeta, reader: reader || standaloneMeta, langId, isPending, llmConfig, learnedVocabulary, maxTokens, readerLength, useStructuredOutput, nativeLang, immersionMode,
    syllabus, generatedReaders, learningActivity, difficultyFeedback,
  });

  // Cancel speech & close popovers when lesson changes
  useEffect(() => {
    stopSpeaking();
    setActiveVocab(null);
    clearSelection();
    closeSentencePopover();
  }, [lessonKey, stopSpeaking, clearSelection, closeSentencePopover]); // all stable hook returns

  // Load from cache to avoid flash of "Generate Reader" button.
  // generatedReaders intentionally excluded — loadedKeysRef guards against re-runs,
  // and adding generatedReaders would re-fire on every reader save.
  useEffect(() => {
    if (lessonKey && !generatedReaders[lessonKey] && !loadedKeysRef.current.has(lessonKey)) {
      loadedKeysRef.current.add(lessonKey);
      dispatch({ type: LOAD_CACHED_READER, payload: { lessonKey } });
    }
  }, [lessonKey, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps -- generatedReaders excluded (ref-guard pattern)

  // Scroll to top when lesson changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lessonKey]);

  // Track when a reader is opened (for LRU eviction)
  useEffect(() => {
    if (lessonKey && reader) act.touchReader(lessonKey);
  }, [lessonKey, !!reader, act]); // act is stable after useMemo

  async function handleRegenConfirm() {
    setConfirmRegen(false);
    act.clearReader(lessonKey);
    await handleGenerate();
  }

  async function handleTranslate(index, text) {
    setTranslatingIndex(index);
    try {
      const translation = await translateText(text, langId, { to: nativeLang });
      const existing = reader.paragraphTranslations || {};
      act.setReader(lessonKey, { ...reader, paragraphTranslations: { ...existing, [index]: translation } });
    } catch (err) {
      act.notify('error', t('notify.translationFailed', { error: err.message }));
    } finally {
      setTranslatingIndex(null);
    }
  }

  async function handleTranslateVocabExample(index, type, text) {
    const key = `${type}-${index}`;
    setTranslatingVocabKey(key);
    try {
      const translation = await translateText(text, langId, { to: nativeLang });
      const existing = reader.vocabTranslations || {};
      act.setReader(lessonKey, { ...reader, vocabTranslations: { ...existing, [key]: translation } });
    } catch (err) {
      act.notify('error', t('notify.translationFailed', { error: err.message }));
    } finally {
      setTranslatingVocabKey(null);
    }
  }

  function handleCacheVocabTranslations(translations) {
    const existing = reader.vocabTranslations || {};
    act.setReader(lessonKey, { ...reader, vocabTranslations: { ...existing, ...translations } });
  }

  function handleCacheQuestionTranslations(translations) {
    const existing = reader.questionTranslations || {};
    act.setReader(lessonKey, { ...reader, questionTranslations: { ...existing, ...translations } });
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const ok = await restoreEvictedReader(lessonKey);
      if (!ok) {
        act.notify('error', t('notify.couldNotRestore'));
      }
    } catch {
      act.notify('error', t('notify.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  }

  // Proficiency badge text
  const profBadge = `${langConfig.proficiency.name} ${reader?.level ?? lessonMeta?.level ?? ''}`;

  const readerCtx = useMemo(() => reader ? ({
    reader, lessonKey, langId, nativeLang,
    renderChars, showParagraphTools: translateButtons,
    ttsSupported, speakingKey, speakText, stopSpeaking,
    onWordClick: handleWordClick,
  }) : null, [reader, lessonKey, langId, nativeLang, renderChars, translateButtons, ttsSupported, speakingKey, speakText, stopSpeaking, handleWordClick]);

  // ── Empty state ─────────────────────────────────────────────
  if (!lessonKey) {
    return <ReaderEmptyState decorativeChars={decorativeChars} charIndex={charIndex} onOpenSidebar={onOpenSidebar} />;
  }

  // ── Error ───────────────────────────────────────────────────
  if (error) {
    return <ReaderErrorState error={error} onRetry={handleGenerate} onDismiss={() => act.clearError()} />;
  }

  // ── Streaming preview (Anthropic) ────────────────────────────
  if (!reader && isPending && streamingText !== null) {
    return <ReaderStreamingPreview lessonMeta={lessonMeta} langId={langId} streamingText={streamingText} />;
  }

  // ── Generating (non-streaming) ─────────────────────────────
  if (!reader && isPending) {
    return <ReaderGeneratingState lessonMeta={lessonMeta} langId={langId} targetLength={readerLength} />;
  }

  // ── Evicted (archived) reader ───────────────────────────────
  if (!reader && !isPending && lessonKey && evictedReaderKeys.has(lessonKey)) {
    return <ReaderEvictedState lessonMeta={lessonMeta} langId={langId} restoring={restoring} onRestore={handleRestore} />;
  }

  // ── Not yet generated ───────────────────────────────────────
  if (!reader) {
    return (
      <ReaderPregenerate
        lessonMeta={lessonMeta}
        langId={langId}
        readerLength={readerLength}
        setReaderLength={setReaderLength}
        onGenerate={handleGenerate}
        isPending={isPending}
        llmConfig={llmConfig}
        activeProvider={activeProvider}
        nativeLang={nativeLang}
        generatedInTargetLang={syllabus?.generatedInTargetLang}
      />
    );
  }

  // ── Parse error fallback ────────────────────────────────────
  if (reader.parseError && !reader.story) {
    return (
      <div className="reader-view">
        <div className="alert alert-error">
          <span><AlertTriangle size={16} /></span>
          <div><strong>{t('reader.parseError')}</strong> {reader.parseError}. {t('reader.rawOutput')}</div>
        </div>
        <pre className="reader-view__raw">{reader.raw}</pre>
        <button className="btn btn-primary" onClick={handleGenerate} style={{ marginTop: 'var(--space-4)' }}>{t('reader.regenerate')}</button>
      </div>
    );
  }

  // ── Main reading view ───────────────────────────────────────
  const storyParagraphs = (reader.story || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const storyText = storyParagraphs.join('\n\n');

  return (
    <ReaderProvider value={readerCtx}>
    <article className="reader-view fade-in" ref={scrollRef}>
      {storyParagraphs.length > 1 && <ReadingProgressBar progress={scrollProgress} />}
      {/* Quota warning banner */}
      {quotaWarning && (
        <div className="reader-view__quota-warning">
          <span>{t('reader.quotaWarning')}</span>
          <button className="reader-view__quota-dismiss" onClick={() => dispatch({ type: SET_QUOTA_WARNING, payload: false })} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* Demo reader banner */}
      {isDemo && !demoBannerDismissed && (
        <div className="reader-view__demo-banner">
          <span>{t('reader.demoBanner')}</span>
          <button className="reader-view__quota-dismiss" onClick={() => setDemoBannerDismissed(true)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* Native language tip banner */}
      {!isDemo && !nativeLangTipDismissed && (
        <div className="reader-view__tip-banner">
          <span>{t('reader.nativeLangTip')}</span>
          <button className="reader-view__quota-dismiss" onClick={() => { localStorage.setItem('gradedReader_nativeLangTipDismissed', '1'); setNativeLangTipDismissed(true); }} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      {/* Title + TTS */}
      <ReaderHeader
        lessonMeta={lessonMeta}
        profBadge={profBadge}
        storyText={storyText}
        onOpenChat={onOpenChat}
      />

      <hr className="divider" />

      {/* Story */}
      <StorySection
        storyParagraphs={storyParagraphs}
        pinyinOn={pinyinOn}
        romanizer={romanizer}
        vocabProps={{ lookupVocab, handleVocabClick, activeVocab, onCloseVocab: () => setActiveVocab(null) }}
        popoverProps={{ popoverRef, getPopoverPosition, selectionPopover, selectionPopoverRef, sentencePopover, highlightedSentence, sentencePopoverRef, onSentenceEndClick: handleSentenceEndClick, onCloseSelection: () => { setSelectionPopover(null); clearSelection(); }, onCloseSentence: closeSentencePopover }}
        translationProps={{ paragraphTranslations: reader.paragraphTranslations, onTranslate: handleTranslate, translatingIndex }}
      />

      <hr className="divider" />

      {/* Comprehension questions */}
      <ComprehensionQuestions
        key={lessonKey}
        questions={reader.questions}
        reader={reader}
        story={reader.story}
        level={reader.level ?? lessonMeta?.level ?? 3}
        onOpenSettings={onOpenSettings}
        questionTranslations={reader?.questionTranslations || {}}
        onCacheQuestionTranslations={handleCacheQuestionTranslations}
      />

      {/* Vocabulary */}
      <VocabularyList
        vocabulary={reader.vocabulary}
        onTranslateExample={handleTranslateVocabExample}
        translatingKey={translatingVocabKey}
        vocabTranslations={reader?.vocabTranslations || {}}
        generatedInTargetLang={!!reader?.generatedInTargetLang}
        romanizer={romanizer}
      />

      {/* Grammar notes */}
      <GrammarNotes grammarNotes={reader.grammarNotes} generatedInTargetLang={!!reader?.generatedInTargetLang} />

      {/* Accuracy notes */}
      <AccuracyNotes notes={reader.accuracyNotes} langId={langId} nativeLang={nativeLang} generatedInTargetLang={!!reader?.generatedInTargetLang} />

      {/* Chat summary (from tutor conversation) */}
      {reader.chatSummary && (
        <ChatSummary summary={reader.chatSummary} collapsible />
      )}

      {/* Anki export */}
      {reader.ankiJson?.length > 0 && (
        <AnkiExportButton
          ankiJson={reader.ankiJson}
          topic={reader.topic || lessonMeta?.title_en || 'lesson'}
          level={reader.level ?? 3}
          grammarNotes={reader.grammarNotes}
          langId={langId}
          romanizer={romanizer}
          vocabTranslations={reader?.vocabTranslations || {}}
          onCacheVocabTranslations={handleCacheVocabTranslations}
        />
      )}

      <ReaderActions
        isDemo={isDemo}
        isCompleted={isCompleted}
        onMarkComplete={onMarkComplete}
        onUnmarkComplete={onUnmarkComplete}
        lessonKey={lessonKey}
        confirmRegen={confirmRegen}
        setConfirmRegen={setConfirmRegen}
        handleRegenConfirm={handleRegenConfirm}
        onContinueStory={onContinueStory}
        reader={reader}
        lessonMeta={lessonMeta}
        isPending={isPending}
        langId={langId}
        onArchive={onArchive}
        onDelete={onDelete}
        onDifficultyFeedback={(rating) => {
          const level = reader?.level ?? lessonMeta?.level ?? 3;
          act.recordDifficultyFeedback(langId, rating, level, lessonKey);
        }}
        hasFeedback={!!(difficultyFeedback?.[langId] || []).find(e => e.lessonKey === lessonKey)}
        nextActions={postLessonActions.length > 0 ? (
          <NextActionSuggestion
            actions={postLessonActions}
            onShowFlashcards={onShowFlashcards}
            onSelectLesson={onSelectLesson}
            onShowNewForm={onShowNewForm}
          />
        ) : null}
      />
    </article>
    </ReaderProvider>
  );
}
