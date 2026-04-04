import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLang } from '../lib/languages';
import { useT } from '../i18n';
import { Check, Copy, Square, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Popover shown when a word in the story is clicked.
 * Shows the word translation, with an expandable sentence translation section.
 */
export default function SentencePopover({
  sentencePopover,
  popoverRef,
  getPopoverPosition,
  romanizer,
  pinyinOn,
  onTranslateSentence,
  langId,
  ttsSupported,
  speakText,
  speakingKey,
}) {
  if (!sentencePopover) return null;

  const { wordText, sentenceText, rect, wordTranslation, sentenceTranslation, showSentence } = sentencePopover;
  const style = getPopoverPosition(rect, 280);

  return createPortal(
    <SentencePopoverInner
      ref={popoverRef}
      wordText={wordText}
      sentenceText={sentenceText}
      wordTranslation={wordTranslation}
      sentenceTranslation={sentenceTranslation}
      showSentence={showSentence}
      style={style}
      onTranslateSentence={onTranslateSentence}
      langId={langId}
      romanizer={romanizer}
      pinyinOn={pinyinOn}
      ttsSupported={ttsSupported}
      speakText={speakText}
      speakingKey={speakingKey}
    />,
    document.body
  );
}

import { forwardRef } from 'react';

/** Render text with ruby annotations for each target-script character. */
function rubyAnnotate(text, romanizer, scriptRegex, keyPrefix) {
  const chars = [...text];
  let romArr;
  try { romArr = romanizer.romanize(text); } catch (e) { console.warn('[SentencePopover] romanization failed:', e); return text; }
  const nodes = [];
  let nonTarget = '';
  let nonTargetStart = 0;
  for (let i = 0; i < chars.length; i++) {
    if (scriptRegex.test(chars[i])) {
      if (nonTarget) {
        nodes.push(<span key={`${keyPrefix}-t${nonTargetStart}`}>{nonTarget}</span>);
        nonTarget = '';
      }
      nodes.push(<ruby key={`${keyPrefix}-r${i}`}>{chars[i]}<rt>{romArr[i]}</rt></ruby>);
    } else {
      if (!nonTarget) nonTargetStart = i;
      nonTarget += chars[i];
    }
  }
  if (nonTarget) nodes.push(<span key={`${keyPrefix}-tend`}>{nonTarget}</span>);
  return nodes;
}

const SentencePopoverInner = forwardRef(function SentencePopoverInner(
  { wordText, sentenceText, wordTranslation, sentenceTranslation, showSentence, style, onTranslateSentence, langId, romanizer, pinyinOn, ttsSupported, speakText, speakingKey },
  ref
) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  const handleCopy = useCallback(() => {
    const text = wordTranslation ? `${wordText}\n${wordTranslation}` : wordText;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [wordText, wordTranslation]);

  const scriptRegex = useMemo(() => {
    const cfg = getLang(langId);
    return cfg?.scriptRegex || null;
  }, [langId]);

  /** Get plain romanization string for the word. */
  const getRomanization = (text) => {
    if (!romanizer || !scriptRegex) return null;
    try { return romanizer.romanize(text).join(''); } catch { return null; }
  };

  /** Render text with optional ruby annotations. */
  const renderText = (text, keyPrefix) => {
    if (pinyinOn && romanizer && scriptRegex) {
      return rubyAnnotate(text, romanizer, scriptRegex, keyPrefix);
    }
    return text;
  };

  const wordRomanization = getRomanization(wordText);
  const isSpeakingWord = speakingKey === `word-${wordText}`;

  return (
    <div ref={ref} className="reader-view__popover sentence-popover" role="dialog" aria-label="Word translation" style={style}>
      {/* Word section */}
      <div className="popover-tts-row">
        <span className={`sentence-popover__original text-target${pinyinOn && romanizer ? ' sentence-popover__original--ruby' : ''}`}>
          {renderText(wordText, 'wt')}
        </span>
        {ttsSupported && speakText && (
          <button
            className={`popover-tts-btn${isSpeakingWord ? ' popover-tts-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); speakText(wordText, `word-${wordText}`); }}
            title={isSpeakingWord ? t('story.stop') : t('story.listen')}
            aria-label={isSpeakingWord ? t('story.stopSpeaking') : t('story.listenToWord')}
          >
            {isSpeakingWord ? <Square size={12} /> : 'TTS'}
          </button>
        )}
      </div>
      {wordRomanization && !pinyinOn && (
        <span className="reader-view__popover-pinyin">{wordRomanization}</span>
      )}
      <div className="sentence-popover__bottom-row">
        <span className="sentence-popover__translation">
          {wordTranslation || '\u2026'}
        </span>
        <button
          className="sentence-popover__copy-btn"
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          aria-label={copied ? 'Copied' : 'Copy text'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {/* Translate sentence button */}
      <button
        className="sentence-popover__sentence-btn"
        onClick={(e) => { e.stopPropagation(); onTranslateSentence(); }}
      >
        <span>{t('story.translateSentence')}</span>
        {showSentence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded sentence translation */}
      {showSentence && (
        <div className="sentence-popover__sentence-section">
          <span className={`sentence-popover__sentence-text text-target${pinyinOn && romanizer ? ' sentence-popover__original--ruby' : ''}`}>
            {renderText(sentenceText, 'st')}
          </span>
          <span className="sentence-popover__sentence-translation">
            {sentenceTranslation || '\u2026'}
          </span>
        </div>
      )}
    </div>
  );
});
