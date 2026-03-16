/**
 * TutorChat — right-side drawer panel for AI tutor conversation.
 * Desktop: 400px slide-in. Mobile: full-screen.
 */

import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { useAppSelector } from '../../context/useAppSelector';
import { getLang } from '../../lib/languages';
import { getNativeLang } from '../../lib/nativeLanguages';
import { buildLLMConfig, hasAnyUserKey } from '../../lib/llmConfig';
import { buildExternalTutorPrompt } from '../../lib/chatApi';
import { useTutorChat } from '../../hooks/useTutorChat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSummary from './ChatSummary';
import './TutorChat.css';

export default function TutorChat({ lessonKey, reader, lessonMeta, syllabus, onClose }) {
  const t = useT();
  const messagesEndRef = useRef(null);
  const drawerRef = useRef(null);

  const { nativeLang } = useAppSelector(s => ({ nativeLang: s.nativeLang || 'en' }));
  const { providerKeys, activeProvider, activeModels, customBaseUrl } = useAppSelector(s => ({
    providerKeys: s.providerKeys, activeProvider: s.activeProvider,
    activeModels: s.activeModels, customBaseUrl: s.customBaseUrl,
  }));

  const langId = reader?.langId || lessonMeta?.langId || 'zh';
  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const llmConfig = buildLLMConfig({ providerKeys, activeProvider, activeModels, customBaseUrl });
  const hasApiKey = hasAnyUserKey(providerKeys);

  const {
    messages, sendMessage, isGenerating, streamingText,
    generateSummary, summary, clearChat, stopGenerating, error,
  } = useTutorChat({ lessonKey, reader, lessonMeta, langId, nativeLang, llmConfig });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock body scroll on mobile
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleOpenExternal(target) {
    const prompt = buildExternalTutorPrompt(reader, lessonMeta, langConfig, nativeLangName);
    navigator.clipboard.writeText(prompt).catch(() => {});

    const url = target === 'claude'
      ? 'https://claude.ai/new'
      : 'https://chatgpt.com';
    window.open(url, '_blank');
  }

  const showChips = messages.length === 0;

  return (
    <>
      <div className="tutor-chat__overlay" onClick={onClose} />
      <div className="tutor-chat__drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label={t('tutor.title')}>
        {/* Header */}
        <div className="tutor-chat__header">
          <h2 className="tutor-chat__heading">{t('tutor.title')}</h2>
          <div className="tutor-chat__header-actions">
            {messages.length > 0 && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={generateSummary}
                  disabled={isGenerating}
                  title={t('tutor.generateSummary')}
                >
                  {t('tutor.generateSummary')}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={clearChat}
                  disabled={isGenerating}
                  title={t('tutor.clearChat')}
                >
                  {t('tutor.clearChat')}
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm tutor-chat__close" onClick={onClose} aria-label={t('common.close')}>✕</button>
          </div>
        </div>

        {/* Messages area */}
        <div className="tutor-chat__messages">
          {messages.length === 0 && !isGenerating && (
            <div className="tutor-chat__welcome">
              <p>{t('tutor.welcome')}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {/* Streaming indicator */}
          {streamingText !== null && (
            <div className="tutor-chat__message tutor-chat__message--assistant">
              <div className="tutor-chat__message-content">
                {streamingText}
                <span className="tutor-chat__cursor" />
              </div>
            </div>
          )}

          {/* Generating dots (non-streaming) */}
          {isGenerating && streamingText === null && (
            <div className="tutor-chat__message tutor-chat__message--assistant">
              <div className="tutor-chat__message-content tutor-chat__typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="tutor-chat__error">
              {error}
            </div>
          )}

          {/* Summary */}
          {summary && <ChatSummary summary={summary} />}

          <div ref={messagesEndRef} />
        </div>

        {/* Stop button */}
        {isGenerating && (
          <div className="tutor-chat__stop-row">
            <button className="btn btn-ghost btn-sm" onClick={stopGenerating}>{t('tutor.stop')}</button>
          </div>
        )}

        {/* Input */}
        {hasApiKey ? (
          <ChatInput
            onSend={sendMessage}
            onSuggestion={sendMessage}
            isGenerating={isGenerating}
            showChips={showChips}
          />
        ) : (
          <div className="tutor-chat__no-key">
            <p>{t('tutor.noApiKey')}</p>
          </div>
        )}

        {/* External links — always shown */}
        <div className="tutor-chat__external">
          <button className="tutor-chat__external-btn" onClick={() => handleOpenExternal('claude')}>
            {t('tutor.openInClaude')}
          </button>
          <button className="tutor-chat__external-btn" onClick={() => handleOpenExternal('chatgpt')}>
            {t('tutor.openInChatGPT')}
          </button>
        </div>
      </div>
    </>
  );
}
