import { useEffect } from 'react';

/**
 * Shared keyboard handler for flashcard modes.
 * - Escape: calls onClose
 * - Enter/Space (when enabled): calls onNext
 *
 * @param {{ onClose?: () => void, onNext?: () => void, enabled?: boolean }} options
 */
export function useFlashcardKeyboard({ onClose, onNext, enabled = false }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (enabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onNext?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNext, onClose]);
}
