import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { splitParagraphIntoSentences } from '../lib/sentenceSplitter';
import { stripMarkdown } from '../lib/renderInline';
import { getNativeLang } from '../lib/nativeLanguages';
import { getLang } from '../lib/languages';
import { translateText } from '../lib/translate';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useT } from '../i18n';
import { Square } from 'lucide-react';

import WordSegments, { segmentWordsInline } from './WordSegments';

/**
 * Unified popover content with clickable word drill-down.
 * Used by all popover types (vocab, word-click, selection, sentence).
 * Clicking a word inside the popover shows its translation at the bottom.
 */
function PopoverContent({ text, romanization, translation, ttsKey, langId, nativeLang, romanizer, ttsSupported, speakText, speakingKey, t }) {
  const textRef = useRef(null);
  const subAbortRef = useRef(null);
  const [subText, setSubText] = useState(null);
  const [subTranslation, setSubTranslation] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const isSpeaking = speakingKey === ttsKey;

  const scriptRegex = useMemo(() => {
    const cfg = getLang(langId);
    return cfg?.scriptRegex || null;
  }, [langId]);

  const segments = useMemo(() => segmentWordsInline(text, langId), [text, langId]);

  // Reset sub-selection when popover text changes
  useEffect(() => {
    setSubText(null);
    setSubTranslation(null);
    setHoveredIdx(null);
  }, [text]);

  // Clean up abort on unmount
  useEffect(() => {
    return () => { if (subAbortRef.current) subAbortRef.current.abort(); };
  }, []);

  const fetchSubTranslation = useCallback((word) => {
    if (scriptRegex && !scriptRegex.test(word)) return;
    if (word === text) return; // Don't drill into the full text itself

    setSubText(word);
    setSubTranslation(null);

    if (subAbortRef.current) subAbortRef.current.abort();
    const controller = new AbortController();
    subAbortRef.current = controller;

    translateText(word, langId, { to: nativeLang })
      .then(tr => {
        if (!controller.signal.aborted) setSubTranslation(tr);
      })
      .catch(err => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setSubTranslation('(translation failed)');
        }
      });
  }, [text, langId, nativeLang, scriptRegex]);

  // Drag-to-select within the popover text
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const selected = sel.toString().trim();
      if (!selected || selected === text) return;
      fetchSubTranslation(selected);
    };
    el.addEventListener('mouseup', handleMouseUp);
    return () => el.removeEventListener('mouseup', handleMouseUp);
  }, [text, fetchSubTranslation]);

  const handleWordClick = useCallback((e, word) => {
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    fetchSubTranslation(word);
  }, [fetchSubTranslation]);

  const getSubRomanization = (t) => {
    if (!romanizer) return null;
    try { return romanizer.romanize(t).join(' ').replace(/ +/g, ' ').trim(); } catch { return null; }
  };

  const renderText = () => {
    if (!segments) return text;
    return segments.map((seg, i) => {
      if (!seg.isWordLike) return <span key={`p${i}`}>{seg.segment}</span>;
      return (
        <span
          key={i}
          className={`popover-drill-word${hoveredIdx === i ? ' popover-drill-word--hover' : ''}`}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          onClick={(e) => handleWordClick(e, seg.segment)}
        >
          {seg.segment}
        </span>
      );
    });
  };

  const subRom = subText ? getSubRomanization(subText) : null;

  return (
    <>
      <div className="popover-tts-row">
        <span ref={textRef} className="reader-view__popover-chinese text-target">{renderText()}</span>
        {ttsSupported && (
          <button
            className={`popover-tts-btn${isSpeaking ? ' popover-tts-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); speakText(text, ttsKey); }}
            title={isSpeaking ? t('story.stop') : t('story.listen')}
            aria-label={isSpeaking ? t('story.stopSpeaking') : t('story.listenToWord')}
          >
            {isSpeaking ? <Square size={12} /> : 'TTS'}
          </button>
        )}
      </div>
      {romanization && (
        <span className="reader-view__popover-pinyin">{romanization}</span>
      )}
      <span className="reader-view__popover-english">
        {translation || '\u2026'}
      </span>
      {subText && (
        <div className="popover-drill-sub">
          <span className="popover-drill-sub__label">
            {subText}
            {subRom && <span className="popover-drill-sub__rom"> ({subRom})</span>}
            : {subTranslation || '\u2026'}
          </span>
        </div>
      )}
    </>
  );
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
  popoverProps: { popoverRef, getPopoverPosition, selectionPopover, selectionPopoverRef, sentencePopover, highlightedSentence, sentencePopoverRef, onWordClick, onSentenceEndClick, onCloseSelection, onCloseSentence } = {},
  translationProps: { paragraphTranslations, onTranslate, translatingIndex } = {},
}) {
  const t = useT();
  const nativeLangConfig = getNativeLang(nativeLang);
  const [visibleTranslations, setVisibleTranslations] = useState(new Set());

  const sentenceEndRegex = useMemo(() => {
    const cfg = getLang(langId);
    return cfg?.sentenceEndRegex || null;
  }, [langId]);

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

  /** Check if a segment is sentence-ending punctuation */
  function isSentenceEndPunctuation(seg, segIndex, segments) {
    if (seg.type !== 'text') return false;
    if (segIndex !== segments.length - 1) return false;
    if (!sentenceEndRegex) return false;
    return sentenceEndRegex.test(seg.content) && seg.content.length <= 2;
  }

  /** Get romanization string for text (space-separated) */
  function getRomanization(text) {
    if (!romanizer) return null;
    try { return romanizer.romanize(text).join(' ').replace(/ +/g, ' ').trim(); } catch { return null; }
  }

  /** Shared popover content props */
  const popoverContentProps = { langId, nativeLang, romanizer, ttsSupported, speakText, speakingKey, t };

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
                {sentences.map((sentence, si) => {
                  const isHighlighted = highlightedSentence?.pi === pi && highlightedSentence?.si === si;
                  return (
                    <span key={si} className={`reader-view__sentence${isHighlighted ? ' reader-view__sentence--highlighted' : ''}`}>
                      {sentence.segments.map((seg, i) => {
                        // Sentence-ending punctuation — clickable for sentence translation
                        if (isSentenceEndPunctuation(seg, i, sentence.segments)) {
                          return (
                            <span
                              key={i}
                              className="reader-view__sentence-end"
                              onClick={(e) => onSentenceEndClick?.(e, sentence, pi, si)}
                            >
                              {seg.content}
                            </span>
                          );
                        }
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
                          return <WordSegments key={i} text={seg.content} langId={langId} sentence={sentence} renderChars={renderChars} keyPrefix={`${pi}-${si}-b${i}`} onWordClick={onWordClick} tag="strong" />;
                        }
                        if (seg.type === 'italic') {
                          return <WordSegments key={i} text={seg.content} langId={langId} sentence={sentence} renderChars={renderChars} keyPrefix={`${pi}-${si}-em${i}`} onWordClick={onWordClick} tag="em" />;
                        }
                        return <WordSegments key={i} text={seg.content} langId={langId} sentence={sentence} renderChars={renderChars} keyPrefix={`${pi}-${si}-s${i}`} onWordClick={onWordClick} />;
                      })}
                    </span>
                  );
                })}
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
      {/* Vocab popover */}
      {activeVocab && createPortal(
        <div ref={popoverRef} className="reader-view__popover" role="dialog" aria-label="Vocabulary details" style={getPopoverPosition(activeVocab.rect)}>
          <PopoverContent
            text={activeVocab.word.target || activeVocab.word.chinese}
            romanization={activeVocab.word.romanization || activeVocab.word.pinyin}
            translation={activeVocab.word.translation || activeVocab.word.english}
            ttsKey={`vocab-${activeVocab.word.target || activeVocab.word.chinese}`}
            {...popoverContentProps}
          />
        </div>,
        document.body
      )}
      {/* Selection popover (drag-to-select) */}
      {selectionPopover && createPortal(
        <div ref={selectionPopoverRef} className="reader-view__popover" role="dialog" aria-label="Selection translation" style={getPopoverPosition(selectionPopover.rect)}>
          <PopoverContent
            text={selectionPopover.text}
            romanization={selectionPopover.romanization}
            translation={selectionPopover.translation}
            ttsKey={`sel-${selectionPopover.text}`}
            {...popoverContentProps}
          />
        </div>,
        document.body
      )}
      {/* Word / sentence popover (click word or sentence-end punctuation) */}
      {sentencePopover && createPortal(
        <div ref={sentencePopoverRef} className="reader-view__popover" role="dialog" aria-label={sentencePopover.mode === 'sentence' ? 'Sentence translation' : 'Word translation'} style={getPopoverPosition(sentencePopover.rect, sentencePopover.mode === 'sentence' ? 300 : 220)}>
          <PopoverContent
            text={sentencePopover.text}
            romanization={sentencePopover.mode === 'word' ? getRomanization(sentencePopover.text) : null}
            translation={sentencePopover.translation}
            ttsKey={sentencePopover.mode === 'sentence' ? `sent-${sentencePopover.pi}-${sentencePopover.si}` : `word-${sentencePopover.text}`}
            {...popoverContentProps}
          />
        </div>,
        document.body
      )}
    </section>
  );
}
