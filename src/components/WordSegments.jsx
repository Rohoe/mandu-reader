import { useMemo } from 'react';

const LANG_LOCALE = { zh: 'zh', yue: 'zh', ko: 'ko', fr: 'fr', es: 'es', en: 'en' };

export function segmentWordsInline(text, langId) {
  if (typeof Intl.Segmenter !== 'function') return null;
  const locale = LANG_LOCALE[langId];
  if (!locale) return null;
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    return [...segmenter.segment(text)];
  } catch { return null; }
}

/**
 * Parses markdown (bold/italic) then makes each word clickable via WordSegments.
 * Use this for any target-language text that may contain markdown formatting.
 */
export function InteractiveText({ text, langId, renderChars, keyPrefix, onWordClick }) {
  if (!text) return null;
  const mdPattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|[^*]+)/g;
  const nodes = [];
  let m, seg = 0;
  while ((m = mdPattern.exec(text)) !== null) {
    const segKey = `${keyPrefix}-md${seg++}`;
    if (m[2] !== undefined) {
      nodes.push(<WordSegments key={segKey} text={m[2]} langId={langId} renderChars={renderChars} keyPrefix={segKey} onWordClick={onWordClick} tag="strong" />);
    } else if (m[3] !== undefined) {
      nodes.push(<WordSegments key={segKey} text={m[3]} langId={langId} renderChars={renderChars} keyPrefix={segKey} onWordClick={onWordClick} tag="em" />);
    } else {
      nodes.push(<WordSegments key={segKey} text={m[0]} langId={langId} renderChars={renderChars} keyPrefix={segKey} onWordClick={onWordClick} />);
    }
  }
  return <>{nodes}</>;
}

export default function WordSegments({ text, langId, sentence, renderChars, keyPrefix, onWordClick, tag: Tag }) {
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
