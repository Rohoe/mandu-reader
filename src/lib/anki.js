/**
 * Anki export logic.
 * Generates tab-separated .txt files and .apkg packages for Anki import.
 */

import { getLang, DEFAULT_LANG_ID } from './languages';
import { generateApkgBlob } from './ankiApkg';

// ── Shared example block builder ──────────────────────────────

/**
 * Build example parts for a vocabulary card. Used by both .txt and .apkg exports.
 * @param {object} card - Anki card data
 * @param {object} options
 * @param {number} options.cardIndex - Index in the card list
 * @param {boolean} options.exportSentenceRom - Include romanization
 * @param {boolean} options.exportSentenceTrans - Include translation
 * @param {function|null} options.romanizer - Romanizer instance
 * @param {RegExp|null} options.scriptRegex - Script regex for the language
 * @param {object} options.vocabTranslations - Translation cache
 * @returns {{ storyParts: string[], extraParts: string[] }}
 */
export function buildExampleParts(card, { cardIndex, exportSentenceRom, exportSentenceTrans, romanizer, scriptRegex, vocabTranslations }) {
  const storyParts = [];
  if (card.example_story) {
    storyParts.push(card.example_story);
    if (exportSentenceRom && romanizer && scriptRegex) {
      const rom = romanizeForExport(card.example_story, romanizer, scriptRegex);
      if (rom) storyParts.push(`<i>${rom}</i>`);
    }
    const storyTrans = vocabTranslations[`story-${cardIndex}`] || card.example_story_translation;
    if (exportSentenceTrans && storyTrans) storyParts.push(`<i>${storyTrans}</i>`);
    if (card.usage_note_story) storyParts.push(`<i>${card.usage_note_story}</i>`);
  }

  const extraParts = [];
  if (card.example_extra) {
    extraParts.push(card.example_extra);
    if (exportSentenceRom && romanizer && scriptRegex) {
      const rom = romanizeForExport(card.example_extra, romanizer, scriptRegex);
      if (rom) extraParts.push(`<i>${rom}</i>`);
    }
    const extraTrans = vocabTranslations[`extra-${cardIndex}`] || card.example_extra_translation;
    if (exportSentenceTrans && extraTrans) extraParts.push(`<i>${extraTrans}</i>`);
    if (card.usage_note_extra) extraParts.push(`<i>${card.usage_note_extra}</i>`);
  }

  return { storyParts, extraParts };
}

// ── Character-count hint for reverse cards ───────────────────

/**
 * Build an underscore hint showing the number of target-script characters.
 * e.g. "小猫" → "_ _", "고양이" → "_ _ _"
 */
export function buildCharHint(target, scriptRegex) {
  if (!target || !scriptRegex) return '';
  const scriptChars = [...target].filter(ch => scriptRegex.test(ch));
  if (scriptChars.length === 0) return '';
  return scriptChars.map(() => '_').join(' ');
}

// ── Duplicate filtering ───────────────────────────────────────

export function prepareExport(ankiJson, exportedWords, langId = DEFAULT_LANG_ID) {
  const langConfig = getLang(langId);
  const targetField = langConfig.fields.target;
  const toExport  = [];
  const skipped   = [];

  for (const card of ankiJson) {
    const targetWord = card[targetField] || card.chinese || card.korean || '';
    if (!targetWord) continue;
    if (exportedWords.has(targetWord)) {
      skipped.push(targetWord);
    } else {
      toExport.push(card);
    }
  }

  return { toExport, skipped };
}

// ── File generation ───────────────────────────────────────────

function grammarNotesToCards(grammarNotes) {
  if (!grammarNotes?.length) return [];
  return grammarNotes.map(note => ({
    target:           note.pattern,
    chinese:          note.pattern,
    korean:           note.pattern,
    english_word:     note.pattern,
    french:           note.pattern,
    spanish:          note.pattern,
    romanization:     '',
    pinyin:           '',
    jyutping:         '',
    english:          note.label,
    example_story:    note.example     || '',
    usage_note_story: note.explanation || '',
    example_extra:    '',
    usage_note_extra: '',
    _isGrammar:       true,
  }));
}

// Returns space-joined romanization of target-script characters only (for Anki plain text).
function romanizeForExport(text, romanizer, scriptRegex) {
  if (!romanizer || !text) return '';
  const chars = [...text];
  const romArr = romanizer.romanize(text);
  const parts = [];
  for (let i = 0; i < chars.length; i++) {
    if (scriptRegex.test(chars[i]) && romArr[i]) {
      parts.push(romArr[i]);
    }
  }
  return parts.join(' ');
}

export function generateAnkiExport(ankiJson, topic, level, exportedWords, { forceAll = false, grammarNotes = [], langId = DEFAULT_LANG_ID, exportSentenceRom = false, exportSentenceTrans = false, romanizer = null, vocabTranslations = {} } = {}) {
  const langConfig = getLang(langId);
  const targetField = langConfig.fields.target;
  const profName = langConfig.proficiency.name;

  const allCards = [...ankiJson, ...grammarNotesToCards(grammarNotes)];
  const { toExport: newCards, skipped } = prepareExport(allCards, exportedWords, langId);

  const today     = new Date().toISOString().split('T')[0];
  const topicTag  = topic.replace(/[\s/\\:*?"<>|]+/g, '_').replace(/_+/g, '_');
  const filename  = `anki_cards_${topicTag}_${profName}${level}_${today}.txt`;

  const toExport = forceAll ? allCards.filter(c => (c[targetField] || c.chinese || c.korean)) : newCards;

  const scriptRegex = langConfig.scriptRegex;

  let content = null;
  if (toExport.length > 0) {
    const lines = toExport.map((card, idx) => formatRow(card, level, topicTag, today, langConfig, exportSentenceRom, exportSentenceTrans, romanizer, scriptRegex, vocabTranslations, idx));
    content = lines.join('\n');
  }

  return {
    content,
    filename,
    stats:          { exported: toExport.length, skipped: forceAll ? 0 : skipped.length },
    exportedChinese: new Set(toExport.map(c => c[targetField] || c.chinese || c.korean)),
  };
}

function formatRow(card, level, topicTag, date, langConfig, exportSentenceRom = false, exportSentenceTrans = false, romanizer = null, scriptRegex = null, vocabTranslations = {}, cardIndex = 0) {
  const targetField = langConfig.fields.target;
  const romField = langConfig.fields.romanization;
  const transField = langConfig.fields.translation;
  const profName = langConfig.proficiency.name;

  const { storyParts, extraParts } = buildExampleParts(card, { cardIndex, exportSentenceRom, exportSentenceTrans, romanizer, scriptRegex, vocabTranslations });
  const allParts = [...storyParts];
  if (extraParts.length > 0) {
    if (allParts.length > 0) allParts.push('');
    allParts.push(...extraParts);
  }
  const examples = allParts.join('<br>');

  const tags = card._isGrammar
    ? `${profName}${level} ${topicTag} ${date} Grammar`
    : `${profName}${level} ${topicTag} ${date}`;

  const targetWord = card[targetField] || card.chinese || card.korean || '';
  const hint = buildCharHint(targetWord, scriptRegex);

  return [
    sanitize(targetWord),
    sanitize(card[romField] || card.pinyin || card.romanization || ''),
    sanitize(card[transField] || card.english || ''),
    sanitize(examples),
    sanitize(hint),
    sanitize(tags),
  ].join('\t');
}

function sanitize(str) {
  return (str || '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
}

// ── .apkg export ─────────────────────────────────────────────

/**
 * Build card objects suitable for .apkg generation from ankiJson data.
 * Reuses the same example-building logic as the .txt export.
 */
function buildApkgCards(toExport, level, topicTag, date, langConfig, exportSentenceRom, exportSentenceTrans, romanizer, vocabTranslations) {
  const targetField = langConfig.fields.target;
  const romField = langConfig.fields.romanization;
  const transField = langConfig.fields.translation;
  const profName = langConfig.proficiency.name;
  const scriptRegex = langConfig.scriptRegex;

  return toExport.map((card, idx) => {
    const { storyParts, extraParts } = buildExampleParts(card, { cardIndex: idx, exportSentenceRom, exportSentenceTrans, romanizer, scriptRegex, vocabTranslations });
    const exampleBlocks = [];
    if (storyParts.length > 0) exampleBlocks.push(`<div class="ex-group">${storyParts.join('<br>')}</div>`);
    if (extraParts.length > 0) exampleBlocks.push(`<div class="ex-group">${extraParts.join('<br>')}</div>`);

    const tags = card._isGrammar
      ? `${profName}${level} ${topicTag} ${date} Grammar`
      : `${profName}${level} ${topicTag} ${date}`;

    const targetWord = card[targetField] || card.chinese || card.korean || '';
    return {
      target:        targetWord,
      romanization:  card[romField] || card.pinyin || card.romanization || '',
      translation:   card[transField] || card.english || '',
      examples:      exampleBlocks.join(''),
      hint:          buildCharHint(targetWord, scriptRegex),
      tags,
    };
  });
}

export async function generateAnkiApkgExport(ankiJson, topic, level, exportedWords, { forceAll = false, grammarNotes = [], langId = DEFAULT_LANG_ID, exportSentenceRom = false, exportSentenceTrans = false, romanizer = null, vocabTranslations = {} } = {}) {
  const langConfig = getLang(langId);
  const targetField = langConfig.fields.target;
  const profName = langConfig.proficiency.name;

  const allCards = [...ankiJson, ...grammarNotesToCards(grammarNotes)];
  const { toExport: newCards, skipped } = prepareExport(allCards, exportedWords, langId);

  const today    = new Date().toISOString().split('T')[0];
  const topicTag = topic.replace(/[\s/\\:*?"<>|]+/g, '_').replace(/_+/g, '_');
  const filename = `anki_cards_${topicTag}_${profName}${level}_${today}.apkg`;

  const toExport = forceAll ? allCards.filter(c => (c[targetField] || c.chinese || c.korean)) : newCards;

  let blob = null;
  if (toExport.length > 0) {
    const deckName = `${langConfig.deckLabel || 'Graded'} Reader::${profName}${level}`;
    const apkgCards = buildApkgCards(toExport, level, topicTag, today, langConfig, exportSentenceRom, exportSentenceTrans, romanizer, vocabTranslations);
    blob = await generateApkgBlob(apkgCards, deckName, langId);
  }

  return {
    blob,
    filename,
    stats:          { exported: toExport.length, skipped: forceAll ? 0 : skipped.length },
    exportedChinese: new Set(toExport.map(c => c[targetField] || c.chinese || c.korean)),
  };
}

// ── Browser download ──────────────────────────────────────────

export async function downloadFile(content, filename) {
  const bom  = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' });
  await triggerDownload(blob, filename);
}

export async function downloadBlob(blob, filename) {
  await triggerDownload(blob, filename);
}

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function canShareFile(blob, filename) {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const file = new File([blob], filename, { type: blob.type });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function triggerDownload(blob, filename) {
  // On mobile, prefer the Web Share API — it lets the user send the file
  // directly to Anki, Files, or any other app.
  if (isMobile() && canShareFile(blob, filename)) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // User cancelled or share failed — fall through to <a> download
      if (err.name === 'AbortError') return; // user cancelled, nothing to do
    }
  }

  // Fallback: classic <a download> approach.
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Delay cleanup — mobile browsers need time to initiate the download
  // before the blob URL is revoked.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 60_000);
}
