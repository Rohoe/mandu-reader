import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { splitParagraphIntoSentences } from '../lib/sentenceSplitter';
import { stripMarkdown } from '../lib/renderInline';
import { getNativeLang } from '../lib/nativeLanguages';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useT } from '../i18n';
import { Volume2, Square } from 'lucide-react';
import SentencePopover from './SentencePopover';

const LANG_LOCALE = { zh: 'zh', yue: 'zh', ko: 'ko', fr: 'fr', es: 'es', en: 'en' };

/**
 * Splits a text segment into individual word spans with hover/click behavior.
 * Falls back to a plain span if Intl.Segmenter is unavailable.
 */
function WordSegments({ text, langId, sentence, renderChars, keyPrefix, onWordClick, tag: Tag }) {
  const segments = useMemo(() => segmentWordsInline(text, langId), [text, langId]);

  if (!segments) {
    const inner = <span>{renderChars(text, keyPrefix)}</span>;
    return Tag ? <Tag>{inner}</Tag> : inner;
  }

  const nodes = segments.map((seg, i) => {
    if (!seg.isWordLike) {
      return <span key={`p${i}`}>{renderChars(seg.segment, `${keyPrefix}-p${i}`)}</span>;
    }
    return (
      <span
        key={i}
        className="reader-view__word"
        onClick={(e) => { e.stopPropagation(); onWordClick && onWordClick(e, seg.segment, sentence); }}
      >
        {renderChars(seg.segment, `${keyPrefix}-w${i}`)}
      </span>
    );
  });

  return Tag ? <Tag>{nodes}</Tag> : <>{nodes}</>;
}

function segmentWordsInline(text, langId) {
  if (typeof Intl.Segmenter !== 'function') return null;
  const locale = LANG_LOCALE[langId];
  if (!locale) return null;
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    return [...segmenter.segment(text)];
  } catch { return null; }
}

export default function StorySection({
  storyParagraphs,
  pinyinOn,
  renderChars,
  showParagraphTools,
  langId,
  nativeLang,
  romanizer,
  // Grouped props
  ttsProps: { ttsSupported, speakingKey, speakText } = {},
  vocabProps: { lookupVocab, handleVocabClick, activeVocab, onCloseVocab } = {},
  popoverProps: { popoverRef, getPopoverPosition, selectionPopover, selectionPopoverRef, sentencePopover, sentencePopoverRef, onWordClick, onTranslateSentence, onCloseSelection, onCloseSentence } = {},
  translationProps: { paragraphTranslations, onTranslate, translatingIndex } = {},
}) {
  const t = useT();
  const nativeLangConfig = getNativeLang(nativeLang);
  const [visibleTranslations, setVisibleTranslations] = useState(new Set());

  // Focus traps for popovers
  const stableCloseVocab = useCallback(() => onCloseVocab?.(), [onCloseVocab]);
  const stableCloseSelection = useCallback(() => onCloseSelection?.(), [onCloseSelection]);
  const stableCloseSentence = useCallback(() => onCloseSentence?.(), [onCloseSentence]);
  useFocusTrap(popoverRef, !!activeVocab, stableCloseVocab);
  useFocusTrap(selectionPopoverRef, !!selectionPopover, stableCloseSelection);
  useFocusTrap(sentencePopoverRef, !!sentencePopover, stableCloseSentence);

  function handleTranslateClick(e, index, para) {
    e.stopPropagation();
    const cached = paragraphTranslations && paragraphTranslations[index];
    if (cached) {
      setVisibleTranslations(prev => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    } else {
      setVisibleTranslations(prev => new Set(prev).add(index));
      onTranslate(index, para);
    }
  }

  function handleTtsClick(e, para, paraKey) {
    e.stopPropagation();
    speakText(stripMarkdown(para), paraKey);
  }

  function getSentencePopoverPosition(rect, width = 320) {
    const gap = 8;
    const popoverWidth = width;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
    // Always use top-anchored positioning so the popover grows downward
    // (prevents expanding upward off-screen when sub-translation is added)
    const estimatedHeight = 120;
    const preferAbove = rect.top - gap - estimatedHeight > 8;
    const top = preferAbove ? rect.top - gap - estimatedHeight : rect.bottom + gap;
    return {
      position: 'fixed',
      zIndex: 60,
      width: popoverWidth,
      left,
      top: Math.max(8, top),
    };
  }

  return (
    <section className="reader-view__story-section" role="article" aria-label="Story content">
      <div className={`reader-view__story text-target ${pinyinOn ? 'reader-view__story--pinyin' : ''}`}>
        {storyParagraphs.map((para, pi) => {
          const paraKey = `para-${pi}`;
          const isSpeaking = speakingKey === paraKey;
          const isTranslating = translatingIndex === pi;
          const translation = paragraphTranslations && paragraphTranslations[pi];
          const showTranslation = visibleTranslations.has(pi) && translation;
          const sentences = splitParagraphIntoSentences(para, langId);
          return (
            <div key={pi} className="reader-view__para-wrapper">
              <p className={`reader-view__paragraph ${isSpeaking ? 'reader-view__paragraph--speaking' : ''}`}>
                {sentences.map((sentence, si) => (
                  <span key={si} className="reader-view__sentence">
                    {sentence.segments.map((seg, i) => {
                      if (seg.type === 'bold') {
                        const entry = lookupVocab(seg.content);
                        if (entry) {
                          return (
                            <button
                              key={i}
                              className="reader-view__vocab-btn"
                              onClick={(e) => handleVocabClick(e, entry)}
                            >
                              {renderChars(seg.content, `${pi}-${si}-b${i}`)}
                            </button>
                          );
                        }
                        return (
                          <strong key={i} className="reader-view__vocab">
                            {renderChars(seg.content, `${pi}-${si}-b${i}`)}
                          </strong>
                        );
                      }
                      if (seg.type === 'italic') {
                        return <WordSegments key={i} text={seg.content} langId={langId} sentence={sentence} renderChars={renderChars} keyPrefix={`${pi}-${si}-em${i}`} onWordClick={onWordClick} tag="em" />;
                      }
                      return <WordSegments key={i} text={seg.content} langId={langId} sentence={sentence} renderChars={renderChars} keyPrefix={`${pi}-${si}-s${i}`} onWordClick={onWordClick} />;
                    })}
                  </span>
                ))}
                {showParagraphTools && ttsSupported && (
                  <button
                    className={`reader-view__para-tts-btn ${isSpeaking ? 'reader-view__para-tts-btn--active' : ''}`}
                    onClick={(e) => handleTtsClick(e, para, paraKey)}
                    title={isSpeaking ? t('story.stop') : t('story.listen')}
                    aria-label={isSpeaking ? t('story.stopSpeaking') : t('story.listenToParagraph')}
                  >
                    {isSpeaking ? <Square size={12} /> : 'TTS'}
                  </button>
                )}
                {showParagraphTools && (
                  <button
                    className={`reader-view__translate-btn ${isTranslating ? 'reader-view__translate-btn--loading' : ''} ${showTranslation ? 'reader-view__translate-btn--active' : ''}`}
                    onClick={(e) => handleTranslateClick(e, pi, para)}
                    disabled={isTranslating}
                    title={showTranslation ? t('story.hideTranslation') : t('story.translateTo', { lang: nativeLangConfig.name })}
                    aria-label={showTranslation ? t('story.hideTranslation') : t('story.translateTo', { lang: nativeLangConfig.name })}
                  >
                    {nativeLangConfig.shortLabel}
                  </button>
                )}
              </p>
              {showTranslation && (
                <div className="reader-view__translation">
                  <p className="reader-view__translation-text">{translation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {activeVocab && createPortal(
        <div ref={popoverRef} className="reader-view__popover" role="dialog" aria-label="Vocabulary details" style={getPopoverPosition(activeVocab.rect)}>
          <div className="popover-tts-row">
            <span className="reader-view__popover-chinese text-target">{activeVocab.word.target || activeVocab.word.chinese}</span>
            {ttsSupported && (
              <button
                className={`popover-tts-btn${speakingKey === `vocab-${activeVocab.word.target || activeVocab.word.chinese}` ? ' popover-tts-btn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); speakText(activeVocab.word.target || activeVocab.word.chinese, `vocab-${activeVocab.word.target || activeVocab.word.chinese}`); }}
                title={speakingKey === `vocab-${activeVocab.word.target || activeVocab.word.chinese}` ? t('story.stop') : t('story.listen')}
                aria-label={speakingKey === `vocab-${activeVocab.word.target || activeVocab.word.chinese}` ? t('story.stopSpeaking') : t('story.listenToWord')}
              >
                {speakingKey === `vocab-${activeVocab.word.target || activeVocab.word.chinese}` ? <Square size={12} /> : 'TTS'}
              </button>
            )}
          </div>
          <span className="reader-view__popover-pinyin">{activeVocab.word.romanization || activeVocab.word.pinyin}</span>
          <span className="reader-view__popover-english">{activeVocab.word.translation || activeVocab.word.english}</span>
        </div>,
        document.body
      )}
      {selectionPopover && createPortal(
        <div ref={selectionPopoverRef} className="reader-view__popover reader-view__selection-popover" role="dialog" aria-label="Selection translation" style={getPopoverPosition(selectionPopover.rect)}>
          <div className="popover-tts-row">
            <span className="reader-view__selection-text text-target">{selectionPopover.text}</span>
            {ttsSupported && (
              <button
                className={`popover-tts-btn${speakingKey === `sel-${selectionPopover.text}` ? ' popover-tts-btn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); speakText(selectionPopover.text, `sel-${selectionPopover.text}`); }}
                title={speakingKey === `sel-${selectionPopover.text}` ? t('story.stop') : t('story.listen')}
                aria-label={speakingKey === `sel-${selectionPopover.text}` ? t('story.stopSpeaking') : t('story.listenToSelection')}
              >
                {speakingKey === `sel-${selectionPopover.text}` ? <Square size={12} /> : 'TTS'}
              </button>
            )}
          </div>
          {selectionPopover.romanization && (
            <span className="reader-view__selection-romanization">{selectionPopover.romanization}</span>
          )}
          <span className="reader-view__selection-translation">
            {selectionPopover.translation || '\u2026'}
          </span>
        </div>,
        document.body
      )}
      <SentencePopover
        sentencePopover={sentencePopover}
        popoverRef={sentencePopoverRef}
        getPopoverPosition={getSentencePopoverPosition}
        romanizer={romanizer}
        pinyinOn={pinyinOn}
        onTranslateSentence={onTranslateSentence}
        langId={langId}
        ttsSupported={ttsSupported}
        speakText={speakText}
        speakingKey={speakingKey}
      />
    </section>
  );
}
