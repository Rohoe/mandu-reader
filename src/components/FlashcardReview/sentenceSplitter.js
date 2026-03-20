import { getLang } from '../../lib/languages';

/**
 * Split a sentence into tiles for the Sentence Builder mode.
 * CJK (zh, yue): per-character, attaching trailing punctuation to the preceding character.
 * Korean / Latin (ko, fr, es, en): per-whitespace token.
 */
export function splitSentence(sentence, langId) {
  if (!sentence) return [];
  const lang = getLang(langId);
  const scriptType = lang?.scriptType || 'latin';

  if (scriptType === 'cjk') {
    return splitCJK(sentence);
  }
  // syllabic (Korean) and latin both use whitespace splitting
  return splitWhitespace(sentence);
}

/**
 * CJK splitting: each character becomes a tile.
 * Punctuation (full-width and common CJK) attaches to the preceding character tile.
 */
function splitCJK(sentence) {
  const punctuation = /^[\u3000-\u303f\uff00-\uffef\u2000-\u206f.,!?;:'"()\-\s]$/;
  const tiles = [];
  let current = '';

  for (const char of sentence) {
    if (punctuation.test(char)) {
      // Attach punctuation to current tile
      if (current) {
        current += char;
      }
      // If no current tile, skip leading punctuation
    } else {
      if (current) {
        tiles.push(current);
      }
      current = char;
    }
  }
  if (current) tiles.push(current);
  return tiles;
}

/**
 * Whitespace splitting for Korean and Latin-script languages.
 */
function splitWhitespace(sentence) {
  return sentence.split(/\s+/).filter(Boolean);
}
