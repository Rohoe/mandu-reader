import { useMemo } from 'react';
import { getLessonTitle } from '../lib/languages';
import { useT } from '../i18n';
import { MessageCircle, Volume2, Square } from 'lucide-react';

const LANG_LOCALE = { zh: 'zh', yue: 'zh', ko: 'ko', fr: 'fr', es: 'es', en: 'en' };

function segmentWords(text, langId) {
  if (typeof Intl.Segmenter !== 'function') return null;
  const locale = LANG_LOCALE[langId];
  if (!locale) return null;
  try { return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)]; }
  catch { return null; }
}

export default function ReaderHeader({ reader, lessonMeta, langId, profBadge, storyText, ttsSupported, speakingKey, speakText, stopSpeaking, onOpenChat, renderChars, onWordClick }) {
  const t = useT();
  const titleText = reader.titleZh || getLessonTitle(lessonMeta, langId) || '';
  const segments = useMemo(() => segmentWords(titleText, langId), [titleText, langId]);

  const renderTitle = () => {
    if (!segments || !onWordClick) return renderChars ? renderChars(titleText, 'title') : titleText;
    return segments.map((seg, i) => {
      if (!seg.isWordLike) {
        return <span key={`p${i}`}>{renderChars ? renderChars(seg.segment, `title-p${i}`) : seg.segment}</span>;
      }
      return (
        <span
          key={i}
          className="reader-view__word"
          onClick={(e) => { e.stopPropagation(); onWordClick(e, seg.segment, null); }}
        >
          {renderChars ? renderChars(seg.segment, `title-w${i}`) : seg.segment}
        </span>
      );
    });
  };

  return (
    <header className="reader-view__header">
      <div className="reader-view__header-text">
        <div className="reader-view__meta text-subtle font-display">
          {reader.level && profBadge}
          {reader.topic && ` · ${reader.topic.charAt(0).toUpperCase() + reader.topic.slice(1)}`}
        </div>
        <h1 className="reader-view__title text-target-title">
          {renderTitle()}
        </h1>
        {reader.titleEn && <p className="reader-view__title-en font-display text-muted">{reader.titleEn}</p>}
      </div>
      <div className="reader-view__header-actions">
        {onOpenChat && (
          <button
            className="btn btn-ghost btn-sm reader-view__tts-btn"
            onClick={onOpenChat}
            title={t('tutor.chatWithTutor')}
            aria-label={t('tutor.chatWithTutor')}
          >
            <MessageCircle size={18} />
          </button>
        )}
        {ttsSupported && (
          <button
            className={`btn btn-ghost btn-sm reader-view__tts-btn ${speakingKey === 'story' ? 'reader-view__tts-btn--active' : ''}`}
            onClick={() => speakingKey ? (window.speechSynthesis.cancel(), stopSpeaking()) : speakText(storyText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1'), 'story')}
            title={speakingKey ? t('reader.header.stop') : t('reader.header.listenToStory')}
            aria-label={speakingKey ? t('reader.header.stop') : t('reader.header.listenToStory')}
          >
            {speakingKey ? <Square size={16} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>
    </header>
  );
}
