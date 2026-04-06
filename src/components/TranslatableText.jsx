import { useState, useCallback } from 'react';
import { translateText } from '../lib/translate';
import { getNativeLang } from '../lib/nativeLanguages';
import { useT } from '../i18n';

/**
 * Wraps text that may be in the target language (for advanced learners).
 * Shows a small translate button that toggles a native-language translation.
 *
 * Props:
 * - text: the text to display
 * - langId: target language id (for translation source)
 * - nativeLang: native language id (for translation target)
 * - enabled: if false, renders text without translate button
 * - tag: wrapper element (default 'p')
 * - className: class for the wrapper
 */
export default function TranslatableText({ text, langId, nativeLang, enabled, tag: Tag = 'p', className, children }) {
  const t = useT();
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const nativeLangConfig = getNativeLang(nativeLang);

  const handleToggle = useCallback(async () => {
    if (translation) {
      setShow(s => !s);
      return;
    }
    setLoading(true);
    setShow(true);
    try {
      const result = await translateText(text, langId, { to: nativeLang });
      setTranslation(result);
    } catch {
      setTranslation(t('notify.translationFailed', { error: '' }));
    } finally {
      setLoading(false);
    }
  }, [text, langId, nativeLang, translation, t]);

  if (!enabled) {
    return <Tag className={className}>{children || text}</Tag>;
  }

  return (
    <div className="translatable-text">
      <Tag className={className}>{children || text}</Tag>
      <button
        className={`translatable-text__btn${show ? ' translatable-text__btn--active' : ''}${loading ? ' translatable-text__btn--loading' : ''}`}
        onClick={handleToggle}
        disabled={loading}
        title={show ? t('story.hideTranslation') : t('story.translateTo', { lang: nativeLangConfig.name })}
        aria-label={show ? t('story.hideTranslation') : t('story.translateTo', { lang: nativeLangConfig.name })}
      >
        {nativeLangConfig.shortLabel}
      </button>
      {show && translation && (
        <div className="translatable-text__translation">{translation}</div>
      )}
    </div>
  );
}
