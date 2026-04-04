import { useState, useCallback, useRef } from 'react';
import { translateText } from '../lib/translate';
import { usePopoverDismissal } from './usePopoverDismissal';

/**
 * Manages word-click-to-translate popover state.
 * Clicking a word shows its translation; a button expands to sentence translation.
 */
export function useSentenceTranslate(langId, nativeLang = 'en') {
  // { wordText, sentenceText, rect, wordTranslation, sentenceTranslation, showSentence }
  const [sentencePopover, setSentencePopover] = useState(null);
  const popoverRef = useRef(null);
  const wordAbortRef = useRef(null);
  const sentenceAbortRef = useRef(null);

  const closeSentencePopover = useCallback(() => {
    setSentencePopover(null);
    if (wordAbortRef.current) { wordAbortRef.current.abort(); wordAbortRef.current = null; }
    if (sentenceAbortRef.current) { sentenceAbortRef.current.abort(); sentenceAbortRef.current = null; }
  }, []);

  /**
   * Called when a word in the story text is clicked.
   * Opens a popover showing the word translation, with option to translate sentence.
   */
  const handleWordClick = useCallback((e, wordText, sentence) => {
    // Bail if clicking a vocab button (let vocab popover handle it)
    if (e.target.closest('.reader-view__vocab-btn')) return;

    // Bail if there's a text selection (let selection popover handle it)
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const sentenceText = sentence.plainText;

    // Toggle off if clicking the same word
    setSentencePopover(prev => {
      if (prev && prev.wordText === wordText && prev.sentenceText === sentenceText) return null;
      return { wordText, sentenceText, rect, wordTranslation: null, sentenceTranslation: null, showSentence: false };
    });

    // Abort any previous word translation request
    if (wordAbortRef.current) wordAbortRef.current.abort();
    const controller = new AbortController();
    wordAbortRef.current = controller;

    // Fetch word translation
    translateText(wordText, langId, { to: nativeLang })
      .then(translation => {
        if (controller.signal.aborted) return;
        setSentencePopover(prev =>
          prev && prev.wordText === wordText && prev.sentenceText === sentenceText
            ? { ...prev, wordTranslation: translation }
            : prev
        );
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setSentencePopover(prev =>
          prev && prev.wordText === wordText && prev.sentenceText === sentenceText
            ? { ...prev, wordTranslation: '(translation failed)' }
            : prev
        );
      });
  }, [langId, nativeLang]);

  /**
   * Called when user clicks "Translate sentence" button in the popover.
   * Fetches and shows the full sentence translation.
   */
  const handleTranslateSentence = useCallback(() => {
    setSentencePopover(prev => {
      if (!prev) return null;
      // If already fetched, just toggle visibility
      if (prev.sentenceTranslation) return { ...prev, showSentence: !prev.showSentence };
      return { ...prev, showSentence: true };
    });

    // Only fetch if not already fetched
    setSentencePopover(prev => {
      if (!prev || prev.sentenceTranslation) return prev;

      // Abort any previous sentence translation request
      if (sentenceAbortRef.current) sentenceAbortRef.current.abort();
      const controller = new AbortController();
      sentenceAbortRef.current = controller;
      const sentenceText = prev.sentenceText;

      translateText(sentenceText, langId, { to: nativeLang })
        .then(translation => {
          if (controller.signal.aborted) return;
          setSentencePopover(p =>
            p && p.sentenceText === sentenceText
              ? { ...p, sentenceTranslation: translation }
              : p
          );
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.name === 'AbortError') return;
          setSentencePopover(p =>
            p && p.sentenceText === sentenceText
              ? { ...p, sentenceTranslation: '(translation failed)' }
              : p
          );
        });

      return prev;
    });
  }, [langId, nativeLang]);

  // Close on Escape, outside click, or scroll
  usePopoverDismissal(!!sentencePopover, popoverRef, closeSentencePopover, {
    ignoreSelectors: ['.reader-view__word', '.reader-view__vocab-btn'],
    pointerDelay: 50,
  });

  return {
    sentencePopover,
    sentencePopoverRef: popoverRef,
    handleWordClick,
    handleTranslateSentence,
    closeSentencePopover,
  };
}
