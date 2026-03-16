/**
 * Chat input with text area, send button, and suggestion chips.
 */

import { useState, useRef, useEffect } from 'react';
import { useT } from '../../i18n';

const SUGGESTION_KEYS = [
  'tutor.quizMe',
  'tutor.explainGrammar',
  'tutor.discussStory',
  'tutor.summarizeLesson',
];

export default function ChatInput({ onSend, onSuggestion, isGenerating, showChips }) {
  const t = useT();
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-focus textarea when chips disappear (i.e. after first message)
  useEffect(() => {
    if (!showChips) textareaRef.current?.focus();
  }, [showChips]);

  function handleSubmit(e) {
    e?.preventDefault();
    if (!text.trim() || isGenerating) return;
    onSend(text);
    setText('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e) {
    setText(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  return (
    <div className="tutor-chat__input-area">
      {showChips && (
        <div className="tutor-chat__chips">
          {SUGGESTION_KEYS.map(key => (
            <button
              key={key}
              className="tutor-chat__chip"
              onClick={() => onSuggestion(t(key))}
              disabled={isGenerating}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
      <form className="tutor-chat__input-row" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="tutor-chat__textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t('tutor.placeholder')}
          rows={1}
          disabled={isGenerating}
        />
        <button
          type="submit"
          className="tutor-chat__send-btn"
          disabled={!text.trim() || isGenerating}
          aria-label={t('tutor.send')}
        >
          ↑
        </button>
      </form>
    </div>
  );
}
