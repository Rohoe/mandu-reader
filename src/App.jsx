import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useAppSelector } from './context/useAppSelector';
import { actions } from './context/actions';
import { useT } from './i18n';
import { CLEAR_NOTIFICATION } from './context/actionTypes';
import { generateReader, extendSyllabus } from './lib/api';
import { buildLLMConfig } from './lib/llmConfig';
import { loadLastSession, saveLastSession } from './lib/storage';
import { parseReaderResponse, normalizeStructuredReader } from './lib/parser';
import { mapReaderVocabulary } from './lib/vocabMapper';
import { DEMO_READER_KEY } from './lib/demoReader';
import SyllabusPanel from './components/SyllabusPanel';
import SyllabusHome from './components/SyllabusHome';
import ReaderView from './components/ReaderView';
import TopicForm from './components/TopicForm';
import Settings from './components/Settings';
import StatsDashboard from './components/StatsDashboard';
import FlashcardReview from './components/FlashcardReview';
import SignInModal from './components/SignInModal';
import TutorChat from './components/TutorChat';

import ErrorBoundary from './components/ErrorBoundary';
import LoadingIndicator from './components/LoadingIndicator';
import PWABanner from './components/PWABanner';
import './App.css';

// ── Notification toast ─────────────────────────────────────────

function Notification() {
  const notification = useAppSelector(s => s.notification);
  const { dispatch } = useApp();
  if (!notification) return null;
  return (
    <div className={`app-notification app-notification--${notification.type} fade-in`}>
      <span>{notification.type === 'success' ? '✓' : '⚠'}</span>
      <span>{notification.message}</span>
      {notification.action && (
        <button
          className="app-notification__action"
          onClick={() => {
            dispatch({ type: notification.action.type });
            dispatch({ type: CLEAR_NOTIFICATION });
          }}
        >
          {notification.action.label}
        </button>
      )}
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────

function AppShell() {
  const { state, dispatch, pushGeneratedReader } = useApp();
  const act = actions(dispatch);
  const t = useT();
  const { syllabi, syllabusProgress } = state;

  const [showSettings,   setShowSettings]     = useState(false);
  const [showStats,      setShowStats]       = useState(false);
  const [showFlashcards, setShowFlashcards]  = useState(false);
  const [showNewForm,    setShowNewForm]     = useState(false);
  const [showSignIn,     setShowSignIn]      = useState(false);
  const [sidebarOpen,    setSidebarOpen]     = useState(false);
  const [chatOpen,       setChatOpen]       = useState(false);

  // Restore last session, falling back to first non-archived syllabus
  const [activeSyllabusId, setActiveSyllabusId] = useState(() => {
    const session  = loadLastSession();
    const nonArch  = syllabi.filter(s => !s.archived);
    const fromSession = session?.syllabusId && nonArch.find(s => s.id === session.syllabusId);
    return fromSession ? session.syllabusId : (nonArch[0]?.id || null);
  });
  const [syllabusView, setSyllabusView] = useState(() => {
    const session = loadLastSession();
    return session?.syllabusView || 'home';
  });
  const [standaloneKey, setStandaloneKey] = useState(() => {
    const session = loadLastSession();
    if (session?.standaloneKey) return session.standaloneKey;
    // Auto-open demo reader for new users
    const hasDemo = state.standaloneReaders.some(r => r.isDemo);
    return hasDemo ? DEMO_READER_KEY : null;
  });

  // Persist session whenever navigation state changes
  useEffect(() => {
    saveLastSession({ syllabusId: activeSyllabusId, syllabusView, standaloneKey });
  }, [activeSyllabusId, syllabusView, standaloneKey]);

  // Auto-show new form modal for new users with no content
  const nonArchSyllabi = syllabi.filter(s => !s.archived);
  const nonArchStandalone = state.standaloneReaders.filter(r => !r.archived);
  useEffect(() => {
    if (nonArchSyllabi.length === 0 && nonArchStandalone.length === 0) {
      setShowNewForm(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Keep activeSyllabusId valid if the active syllabus is removed or archived
  useEffect(() => {
    const nonArch = syllabi.filter(s => !s.archived);
    if (activeSyllabusId && !nonArch.find(s => s.id === activeSyllabusId)) {
      setActiveSyllabusId(nonArch[0]?.id || null);
      setSyllabusView('home');
    }
  }, [syllabi, activeSyllabusId]);

  // Callback for TopicForm to surface a newly-generated standalone reader
  function onStandaloneGenerated(lessonKey) {
    setStandaloneKey(lessonKey);
  }

  // Derive active lesson info from per-syllabus progress
  const currentSyllabus = syllabi.find(s => s.id === activeSyllabusId) || null;
  const progress        = syllabusProgress[activeSyllabusId] || { lessonIndex: 0, completedLessons: [] };
  const lessonIndex     = progress.lessonIndex;
  const completedSet    = new Set(progress.completedLessons);
  const lessons         = currentSyllabus?.lessons || [];
  const activeMeta      = lessons[lessonIndex] || null;
  const activeLessonKey = standaloneKey
    ? standaloneKey
    : (activeSyllabusId && syllabusView === 'lesson')
      ? `lesson_${activeSyllabusId}_${lessonIndex}`
      : null;

  function handleSelectLesson(syllabusId, idx) {
    setActiveSyllabusId(syllabusId);
    act.setLessonIndex(syllabusId, idx);
    setStandaloneKey(null);
    setSyllabusView('lesson');
    setSidebarOpen(false);
  }

  function handleGoSyllabusHome() {
    setSyllabusView('home');
    setStandaloneKey(null);
  }

  function handleDeleteSyllabus(id) {
    act.removeSyllabus(id);
  }

  function handleMarkComplete() {
    // Learn vocabulary from this reader on completion
    const reader = state.generatedReaders[activeLessonKey];
    const readerLangId = currentSyllabus?.langId || reader?.langId || 'zh';
    const vocab = mapReaderVocabulary(reader, readerLangId);
    if (vocab) act.addVocabulary(vocab);
    if (standaloneKey) {
      act.updateStandaloneReaderMeta({ key: standaloneKey, completedAt: Date.now() });
    } else {
      act.markLessonComplete(activeSyllabusId, lessonIndex);
      if (currentSyllabus && lessonIndex < lessons.length - 1) {
        act.setLessonIndex(activeSyllabusId, lessonIndex + 1);
      }
    }
  }

  function handleUnmarkComplete() {
    if (standaloneKey) {
      act.updateStandaloneReaderMeta({ key: standaloneKey, completedAt: null });
    } else {
      act.unmarkLessonComplete(activeSyllabusId, lessonIndex);
    }
  }

  function handleNewSyllabus(newSyllabusId) {
    setActiveSyllabusId(newSyllabusId);
    setStandaloneKey(null);
    setSyllabusView('home');
  }

  function handleSwitchSyllabus(id) {
    setActiveSyllabusId(id);
    setStandaloneKey(null);
    setSyllabusView('home');
  }

  function handleSelectStandalone(key) {
    setStandaloneKey(key);
    setSidebarOpen(false);
  }

  // Called at the START of standalone generation so lessonMeta clears immediately
  function handleStandaloneGenerating() {
    setStandaloneKey('standalone_pending');
  }

  async function handleContinueStory({ story, topic, level, langId }) {
    const newKey = `standalone_${Date.now()}`;
    const continuationTopic = `Continuation: ${topic}`;

    // Determine series context from the current reader
    const parentKey = standaloneKey || activeLessonKey;
    const parentMeta = state.standaloneReaders.find(r => r.key === parentKey);
    const seriesId = parentMeta?.seriesId || parentKey;
    const episodeNumber = (parentMeta?.episodeNumber || 1) + 1;

    // Retroactively tag parent as episode 1 if it wasn't in a series yet
    if (parentMeta && !parentMeta.seriesId) {
      act.updateStandaloneReaderMeta({ key: parentKey, seriesId, episodeNumber: 1 });
    }

    act.addStandaloneReader({ key: newKey, topic: continuationTopic, level, langId, createdAt: Date.now(), seriesId, episodeNumber });
    act.startPendingReader(newKey);
    setStandaloneKey(newKey);
    setSidebarOpen(false);
    try {
      const llmConfig = buildLLMConfig(state);
      const raw    = await generateReader(llmConfig, continuationTopic, level, state.learnedVocabulary, 1200, state.maxTokens, story, langId, { structured: state.useStructuredOutput, nativeLang: state.nativeLang });
      const parsed = state.useStructuredOutput
        ? normalizeStructuredReader(raw, langId)
        : parseReaderResponse(raw, langId);
      pushGeneratedReader(newKey, { ...parsed, topic: continuationTopic, level, langId, lessonKey: newKey });
      // Update sidebar metadata with generated titles so they persist across reloads
      if (parsed.titleZh || parsed.titleEn) {
        act.updateStandaloneReaderMeta({ key: newKey, titleZh: parsed.titleZh, titleEn: parsed.titleEn });
      }
      act.notify('success', t('notify.continuationReady'));
    } catch (err) {
      act.removeStandaloneReader(newKey);
      act.notify('error', t('notify.continuationFailed', { error: err.message.slice(0, 80) }));
    } finally {
      act.clearPendingReader(newKey);
    }
  }

  async function handleExtendSyllabus(additionalCount) {
    if (!activeSyllabusId || !currentSyllabus) return;
    act.setLoading(true, t('notify.expanding'));
    try {
      const llmConfig = buildLLMConfig(state);
      const { lessons: newLessons } = await extendSyllabus(
        llmConfig,
        currentSyllabus.topic,
        currentSyllabus.level,
        currentSyllabus.lessons,
        additionalCount,
        currentSyllabus.langId,
        state.nativeLang,
      );
      act.extendSyllabusLessons(activeSyllabusId, newLessons);
      act.notify('success', t('notify.syllabusExtended', { count: newLessons.length }));
    } catch (err) {
      act.notify('error', t('notify.syllabusExtendFailed', { error: err.message.slice(0, 80) }));
    } finally {
      act.setLoading(false, '');
    }
  }

  if (!state.fsInitialized) {
    return (
      <div className="app-fs-init">
        <LoadingIndicator message={t('app.loading')} />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* ─ Mobile header ─────────────────────────────────── */}
      <header className="app-mobile-header">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label={t('app.openMenu')}
        >
          ☰
        </button>
        <span className="app-mobile-title font-display">漫读</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} aria-label={t('common.settings')}>
          ⚙
        </button>
      </header>

      {/* ─ Sidebar overlay (mobile) ──────────────────────── */}
      {sidebarOpen && (
        <div className="app-sidebar-overlay" role="button" aria-label={t('app.closeSidebar')} tabIndex={0} onClick={() => setSidebarOpen(false)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSidebarOpen(false)} />
      )}

      {/* ─ Left sidebar ──────────────────────────────────── */}
      <div className={`app-sidebar ${sidebarOpen ? 'app-sidebar--open' : ''}`}>
        <ErrorBoundary name="sidebar">
          <SyllabusPanel
            activeSyllabusId={activeSyllabusId}
            standaloneKey={standaloneKey}
            syllabusView={syllabusView}
            onSelectLesson={handleSelectLesson}
            onShowSettings={() => setShowSettings(true)}
            onShowStats={() => setShowStats(true)}
            onShowFlashcards={() => setShowFlashcards(true)}
            onSwitchSyllabus={handleSwitchSyllabus}
            onSelectStandalone={handleSelectStandalone}
            onGoSyllabusHome={handleGoSyllabusHome}
            onShowNewForm={() => setShowNewForm(true)}
            onShowSignIn={() => setShowSignIn(true)}
          />
        </ErrorBoundary>
      </div>

      {/* ─ Main content ──────────────────────────────────── */}
      <main className="app-main">
        <ErrorBoundary name="reader">
        {activeSyllabusId && syllabusView === 'home' && !standaloneKey
          ? (
            <SyllabusHome
              syllabus={currentSyllabus}
              progress={progress}
              onSelectLesson={handleSelectLesson}
              onDelete={() => handleDeleteSyllabus(activeSyllabusId)}
              onArchive={() => {
                act.archiveSyllabus(activeSyllabusId);
                const nextActive = state.syllabi.find(s => !s.archived && s.id !== activeSyllabusId);
                setActiveSyllabusId(nextActive?.id || null);
                setSyllabusView('home');
              }}
              onExtend={handleExtendSyllabus}
            />
          )
          : (
            <ReaderView
              lessonKey={activeLessonKey}
              lessonMeta={standaloneKey ? null : (activeMeta
                ? { ...activeMeta, level: currentSyllabus?.level, langId: currentSyllabus?.langId, lesson_number: lessonIndex + 1 }
                : null)}
              syllabus={standaloneKey ? null : currentSyllabus}
              onMarkComplete={handleMarkComplete}
              onUnmarkComplete={handleUnmarkComplete}
              isCompleted={standaloneKey
                ? !!state.standaloneReaders.find(r => r.key === standaloneKey)?.completedAt
                : completedSet.has(lessonIndex)}
              onContinueStory={handleContinueStory}
              onOpenSidebar={() => setSidebarOpen(true)}
              onOpenSettings={() => setShowSettings(true)}
              onOpenChat={() => setChatOpen(true)}
            />
          )
        }
        </ErrorBoundary>
      </main>

      {/* ─ Settings modal ────────────────────────────────── */}
      {showSettings && (
        <ErrorBoundary name="settings">
          <Settings onClose={() => setShowSettings(false)} />
        </ErrorBoundary>
      )}

      {/* ─ Sign-in modal ─────────────────────────────────── */}
      {showSignIn && (
        <ErrorBoundary name="sign-in">
          <SignInModal onClose={() => setShowSignIn(false)} />
        </ErrorBoundary>
      )}

      {/* ─ Stats modal ──────────────────────────────────── */}
      {showStats && (
        <ErrorBoundary name="stats">
          <StatsDashboard onClose={() => setShowStats(false)} onShowFlashcards={() => { setShowStats(false); setShowFlashcards(true); }} />
        </ErrorBoundary>
      )}

      {/* ─ Flashcard review modal ──────────────────────────── */}
      {showFlashcards && (
        <ErrorBoundary name="flashcards">
          <FlashcardReview onClose={() => setShowFlashcards(false)} />
        </ErrorBoundary>
      )}

      {/* ─ New reader modal ──────────────────────────────── */}
      {showNewForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="new-reader-title" onClick={e => e.target === e.currentTarget && setShowNewForm(false)}>
          <div className="settings-panel card card-padded fade-in">
            <div className="settings-panel__header">
              <h2 id="new-reader-title" className="font-display" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{t('app.newReader')}</h2>
              <button className="btn btn-ghost settings-panel__close" onClick={() => setShowNewForm(false)} aria-label={t('common.close')}>✕</button>
            </div>
            <TopicForm
              onNewSyllabus={(id) => { setShowNewForm(false); handleNewSyllabus(id); }}
              onStandaloneGenerated={(key) => { setShowNewForm(false); onStandaloneGenerated(key); }}
              onStandaloneGenerating={handleStandaloneGenerating}
              onCancel={() => setShowNewForm(false)}
              onOpenSettings={() => { setShowNewForm(false); setShowSettings(true); }}
            />
          </div>
        </div>
      )}

      {/* ─ Tutor chat drawer ──────────────────────────────── */}
      {chatOpen && activeLessonKey && (
        <ErrorBoundary name="tutor-chat">
          <TutorChat
            lessonKey={activeLessonKey}
            reader={state.generatedReaders[activeLessonKey]}
            lessonMeta={standaloneKey ? null : activeMeta}
            syllabus={standaloneKey ? null : currentSyllabus}
            onClose={() => setChatOpen(false)}
          />
        </ErrorBoundary>
      )}

      {/* ─ Toast notification ────────────────────────────── */}
      <Notification />
      <PWABanner />
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
