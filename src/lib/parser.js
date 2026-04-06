/**
 * Parses Claude's markdown response into structured data.
 * All functions return sensible defaults on parse failure.
 */

import { getLang, DEFAULT_LANG_ID } from './languages';

// ── Default result shape ──────────────────────────────────────

const EMPTY_RESULT = Object.freeze({
  raw:              '',
  titleZh:          '',
  titleEn:          '',
  story:            '',
  vocabulary:       [],
  questions:        [],
  ankiJson:         [],
  grammarNotes:     [],
  suggestedTopics:  [],
  accuracyNotes:    [],
  narrativeState:   null,
  parseWarnings:    [],
  parseError:       null,
  langId:           DEFAULT_LANG_ID,
});

// ── Extraction pipeline functions ─────────────────────────────

function extractTitle(rawText) {
  const warnings = [];

  const titleSectionMatch = rawText.match(/#{2,4}\s*(?:1\.\s*)?(?:Title|标题|제목)\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:2\.|Story|故事|이야기))/i);
  if (titleSectionMatch) {
    const titleBlock = titleSectionMatch[1].trim();
    const lines = titleBlock.split('\n').map(l => l.trim()).filter(Boolean);
    const titleZh = (lines[0] || '').replace(/\*\*/g, '').replace(/^\*|\*$/g, '');
    const titleEn = (lines[1] || '').replace(/\*\*/g, '').replace(/^\*|\*$/g, '');
    return { titleZh, titleEn, warnings };
  }

  // Fallback: first # heading
  const h1 = rawText.match(/^#{1,3}\s+(.+)$/m);
  if (h1) {
    warnings.push('Title extracted via fallback (no "## 1. Title" heading found)');
    return { titleZh: h1[1].trim(), titleEn: '', warnings };
  }

  return { titleZh: '', titleEn: '', warnings };
}

function extractStory(rawText, scriptRegex) {
  const warnings = [];

  const storySectionMatch = rawText.match(/#{2,4}\s*(?:2\.\s*)?(?:Story|故事|이야기)\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:3\.|Vocabulary|词汇|어휘))/i);
  if (storySectionMatch) {
    const story = storySectionMatch[1].trim().replace(/^(#{1,4}[^\n]*\n\n?)+/, '').trim();
    return { story, warnings };
  }

  // Fallback: strip heading lines from top, take text up to the next ## section
  const withoutTopHeadings = rawText.replace(/^(#{1,4}[^\n]*\n)+\s*/, '');
  const bodyMatch = withoutTopHeadings.match(/^([\s\S]*?)(?=\n#{1,4}\s)/);
  if (bodyMatch) {
    warnings.push('Story extracted via fallback (no "## 2. Story" heading found)');
    const story = bodyMatch[1].trim().replace(/^(#{1,4}[^\n]*\n\n?)+/, '').trim();
    return { story, warnings };
  }

  // Build a regex for detecting 200+ target script chars (only for non-null scriptRegex)
  if (scriptRegex) {
    const scriptCharClass = scriptRegex.source;
    const blockRegex = new RegExp(`([${scriptCharClass.slice(1, -1)}\\s*_.,，。！？、；：""''（）【】]{200,})`);
    const scriptBlock = rawText.match(blockRegex);
    if (scriptBlock) {
      warnings.push('Story extracted via block regex fallback');
      const story = scriptBlock[1].trim().replace(/^(#{1,4}[^\n]*\n\n?)+/, '').trim();
      return { story, warnings };
    }
  }

  return { story: '', warnings };
}

function extractVocabJson(rawText) {
  const match = rawText.match(/```vocab-json\s*\n([\s\S]*?)\n```/);
  if (match) {
    try {
      const arr = JSON.parse(match[1]);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[parser] Failed to parse vocab-json block:', e);
      return [];
    }
  }
  return [];
}

function extractAccuracyNotes(rawText) {
  const match = rawText.match(/```accuracy-json\s*\n([\s\S]*?)\n```/);
  if (match) {
    try {
      const arr = JSON.parse(match[1]);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[parser] Failed to parse accuracy-json block:', e);
      return [];
    }
  }
  return [];
}

function extractNarrativeState(rawText) {
  // Match section 8 header, capture content until next section or end
  // Section may be 7 or 8 depending on whether accuracy notes are present
  const match = rawText.match(/#{2,4}\s*(?:\d\.\s*)?Story So Far\s*\n+([\s\S]*?)(?=#{2,4}\s*\d|$)/i);
  if (!match) return null;

  const block = match[1].trim();
  if (!block) return null;

  // Split out character updates if present
  const charMatch = block.match(/Character updates?:\s*(.+)/i);
  const characterUpdates = charMatch ? charMatch[1].trim() : '';

  // Running summary is everything before the character updates line
  const runningSummary = charMatch
    ? block.slice(0, charMatch.index).trim()
    : block;

  return { runningSummary, characterUpdates };
}

function normalizeVocabEntry(v) {
  const target = v.target || v.word || v.chinese || v.korean || v.french || v.spanish || v.english_word || '';
  const romanization = v.romanization || v.pinyin || v.jyutping || '';
  const translation = v.translation || v.english || v.definition || '';
  return {
    target,
    romanization,
    translation,
    chinese:      v.chinese || target,
    korean:       v.korean || target,
    pinyin:       romanization,
    english:      v.english || translation,
    exampleStory:             stripExamplePrefix(v.example_story || ''),
    exampleStoryTranslation:  v.example_story_translation || '',
    exampleExtra:             stripExamplePrefix(v.example_extra || ''),
    exampleExtraTranslation:  v.example_extra_translation || '',
    usageNoteStory:           v.usage_note_story || '',
    usageNoteExtra:           v.usage_note_extra || '',
  };
}

function synthesizeAnkiJson(vocabulary) {
  return vocabulary.map(v => ({
    chinese:      v.chinese || v.target,
    korean:       v.korean || v.target,
    target:       v.target,
    pinyin:       v.pinyin || v.romanization,
    romanization: v.romanization,
    english:      v.english || v.translation,
    translation:  v.translation,
    example_story:             v.exampleStory,
    example_story_translation: v.exampleStoryTranslation,
    usage_note_story:          v.usageNoteStory,
    example_extra:             v.exampleExtra,
    example_extra_translation: v.exampleExtraTranslation,
    usage_note_extra:          v.usageNoteExtra,
  }));
}

function extractVocabularySection(rawText, scriptRegex) {
  const vocabSectionMatch = rawText.match(
    /#{2,4}\s*(?:\d\.\s*)?(?:Vocabulary|词汇|어휘)[^\n]*\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:\d\.\s*)?(?:Questions|Comprehension|理解|이해)|```anki-json|```vocab-json|$)/i
  );
  if (vocabSectionMatch) {
    return parseVocabularySection(vocabSectionMatch[1], scriptRegex);
  }
  return [];
}

function extractComprehensionQuestions(rawText) {
  const questionsSectionMatch = rawText.match(
    /#{2,4}\s*(?:\d\.\s*)?(?:Questions|Comprehension|理解|이해)[^\n]*\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:\d\.\s*)?(?:Anki|Grammar|语法|문법)|```anki-json|$)/i
  );
  if (questionsSectionMatch) {
    return parseQuestions(questionsSectionMatch[1]);
  }
  return [];
}

function extractAnkiJson(rawText) {
  const ankiMatch = rawText.match(/```anki-json\s*\n([\s\S]*?)\n```/);
  if (ankiMatch) {
    try {
      return JSON.parse(ankiMatch[1]);
    } catch (e) {
      console.warn('[parser] Failed to parse anki-json block:', e);
      return [];
    }
  }
  return [];
}

function extractGrammarJson(rawText) {
  const match = rawText.match(/```grammar-json\s*\n([\s\S]*?)\n```/);
  if (match) {
    try {
      const arr = JSON.parse(match[1]);
      if (Array.isArray(arr)) {
        return arr.map(n => ({
          pattern:     n.pattern || '',
          label:       n.label || '',
          explanation: n.explanation || '',
          example:     n.example || '',
        }));
      }
    } catch (e) {
      console.warn('[parser] Failed to parse grammar-json block:', e);
    }
  }
  return [];
}

function extractGrammarNotes(rawText) {
  // Try structured JSON first, fall back to markdown parsing
  const jsonNotes = extractGrammarJson(rawText);
  if (jsonNotes.length > 0) return jsonNotes;

  const grammarSectionMatch = rawText.match(
    /#{2,4}\s*(?:\d\.\s*)?(?:Grammar|语法|문법)[^\n]*\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:\d\.\s*)?Suggested|$)/i
  );
  if (grammarSectionMatch) {
    return parseGrammarNotes(grammarSectionMatch[1]);
  }
  return [];
}

function extractSuggestedTopics(rawText) {
  const match = rawText.match(
    /#{2,4}\s*(?:\d\.\s*)?Suggested[^\n]*\s*\n+([\s\S]*?)(?=#{2,4}\s|$)/i
  );
  if (!match) return [];
  return match[1].split('\n')
    .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(line => line.length > 0 && line.length < 200);
}

function enrichVocabularyWithAnki(vocabulary, ankiJson, langConfig) {
  if (vocabulary.length === 0 && ankiJson.length === 0) return vocabulary;

  const targetField = langConfig.fields.target;
  const romField = langConfig.fields.romanization;
  const transField = langConfig.fields.translation;

  function makeVocabFromCard(card) {
    const t = card[targetField] || card.chinese || card.korean || '';
    const r = card[romField] || card.pinyin || card.romanization || '';
    const tr = card[transField] || card.english || '';
    return {
      target: t, romanization: r, translation: tr,
      chinese: t, pinyin: r, english: tr,
      exampleStory:             stripExamplePrefix(card.example_story || ''),
      exampleStoryTranslation:  card.example_story_translation || '',
      exampleExtra:             stripExamplePrefix(card.example_extra || ''),
      exampleExtraTranslation:  card.example_extra_translation || '',
      usageNoteStory:           card.usage_note_story || '',
      usageNoteExtra:           card.usage_note_extra || '',
    };
  }

  if (vocabulary.length === 0 && ankiJson.length > 0) {
    return ankiJson.map(makeVocabFromCard);
  }

  if (vocabulary.length > 0 && ankiJson.length > 0) {
    // Enrich vocabulary items with usage notes + fill missing pinyin from the Anki JSON block
    const ankiByWord = new Map(ankiJson.map(c => [c[targetField] || c.chinese || c.korean, c]));
    const enriched = vocabulary.map(word => {
      const card = ankiByWord.get(word.target || word.chinese);
      if (!card) return word;
      const rom = word.romanization || word.pinyin || card[romField] || card.pinyin || card.romanization || '';
      return {
        ...word,
        target: word.target || word.chinese,
        romanization: rom,
        translation: word.translation || word.english,
        pinyin: rom,
        exampleStoryTranslation: card.example_story_translation || word.exampleStoryTranslation || '',
        exampleExtraTranslation: card.example_extra_translation || word.exampleExtraTranslation || '',
        usageNoteStory:          card.usage_note_story || word.usageNoteStory,
        usageNoteExtra:          card.usage_note_extra || word.usageNoteExtra,
      };
    });
    // Append any words present in ankiJson but absent from the vocabulary section
    const vocabTargets = new Set(enriched.map(v => v.target || v.chinese));
    const missing = ankiJson
      .filter(card => !vocabTargets.has(card[targetField] || card.chinese || card.korean))
      .map(makeVocabFromCard);
    return missing.length > 0 ? [...enriched, ...missing] : enriched;
  }

  return vocabulary;
}

// ── Main reader parser ────────────────────────────────────────

export function parseReaderResponse(rawText, langId = DEFAULT_LANG_ID) {
  const langConfig = getLang(langId);
  const scriptRegex = langConfig.scriptRegex;

  if (!rawText) return { ...EMPTY_RESULT, raw: rawText, langId, parseError: 'Empty response from API.' };

  try {
    const { titleZh, titleEn, warnings: titleWarnings } = extractTitle(rawText);
    const { story, warnings: storyWarnings } = extractStory(rawText, scriptRegex);
    const questions = extractComprehensionQuestions(rawText);
    const grammarNotes = extractGrammarNotes(rawText);
    const suggestedTopics = extractSuggestedTopics(rawText);

    // Try new vocab-json format first
    let vocabulary, ankiJson;
    const vocabJsonEntries = extractVocabJson(rawText);
    if (vocabJsonEntries.length > 0) {
      vocabulary = vocabJsonEntries.map(normalizeVocabEntry);
      ankiJson = synthesizeAnkiJson(vocabulary);
    } else {
      // Legacy fallback: markdown vocab + anki-json enrichment
      const rawVocabulary = extractVocabularySection(rawText, scriptRegex);
      ankiJson = extractAnkiJson(rawText);
      vocabulary = enrichVocabularyWithAnki(rawVocabulary, ankiJson, langConfig);
    }

    return {
      raw: rawText,
      titleZh, titleEn, story,
      vocabulary,
      questions, ankiJson, grammarNotes, suggestedTopics,
      accuracyNotes: extractAccuracyNotes(rawText),
      narrativeState: extractNarrativeState(rawText),
      parseWarnings: [...titleWarnings, ...storyWarnings],
      parseError: null,
      langId,
    };
  } catch (err) {
    console.error('[parser] parseReaderResponse failed:', err);
    return { ...EMPTY_RESULT, raw: rawText, langId, parseError: err.message };
  }
}

// ── Vocabulary section parser ─────────────────────────────────

function parseVocabularySection(text, scriptRegex) {
  const items = [];
  const seen  = new Set();
  if (!text) return items;

  function pushItem(chinese, pinyin, english, afterText) {
    if (seen.has(chinese)) return;
    seen.add(chinese);
    const { examples, usageNotes } = extractExamples(afterText, scriptRegex);
    items.push({
      target: chinese,
      romanization: pinyin,
      translation: english,
      chinese,
      pinyin,
      english,
      exampleStory:   examples[0] || '',
      exampleExtra:   examples[1] || '',
      usageNoteStory: usageNotes[0] || '',
      usageNoteExtra: usageNotes[1] || '',
    });
  }

  // Pattern A: **word** (pinyin) — definition  [() or [], any dash/colon separator]
  const patternA = /\*\*([^*\n]+)\*\*\s*[([]([^)\]\n]{1,40})[)\]]\s*[-–—:]\s*([^\n]+)/g;
  let match;
  while ((match = patternA.exec(text)) !== null) {
    pushItem(
      match[1].trim(),
      match[2].trim(),
      match[3].trim(),
      text.slice(match.index + match[0].length),
    );
  }

  // Pattern B: **word** — definition  (no pinyin brackets; pinyin filled later from ankiJson)
  const patternB = /\*\*([^*\n]+)\*\*\s*[-–—]\s*([^\n*[({]+)/g;
  while ((match = patternB.exec(text)) !== null) {
    pushItem(
      match[1].trim(),
      '',
      match[2].trim(),
      text.slice(match.index + match[0].length),
    );
  }

  // Pattern C: numbered list — 1. **word** (pinyin): definition
  const patternC = /^\d+\.\s*\*\*([^*\n]+)\*\*\s*[([]([^)\]\n]{1,40})[)\]]\s*[:：]\s*([^\n]+)/gm;
  while ((match = patternC.exec(text)) !== null) {
    pushItem(
      match[1].trim(),
      match[2].trim(),
      match[3].trim(),
      text.slice(match.index + match[0].length),
    );
  }

  return items;
}

// Strip verbose prefixes that some LLMs (especially Gemini) add to example lines
function stripExamplePrefix(text) {
  return text
    .replace(/^[-•*]\s*/, '')                                           // bullet markers
    .replace(/^(?:example\s+sentence\s+(?:from\s+story|FROM\s+STORY)\s*:\s*)/i, '')  // "Example sentence FROM STORY:"
    .replace(/^(?:additional\s+example\s+(?:sentence\s*)?:\s*)/i, '')   // "Additional example sentence:"
    .replace(/^(?:example\s+(?:sentence\s*)?:\s*)/i, '')                // "Example sentence:" / "Example:"
    .trim();
}

function extractExamples(text, scriptRegex) {
  const lines = text.split('\n');
  const examples = [];
  const usageNotes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Stop if we hit the next vocab entry
    if (/^\*\*/.test(trimmed) || /^\d+\./.test(trimmed)) break;
    // Skip sub-headers
    if (/^#{1,4}/.test(trimmed)) break;
    // Detect usage note lines: italic (*text*) or "Brief usage note" / "Usage note" prefix
    const bulletStripped = trimmed.replace(/^[-•*]\s*/, '');
    if (/^\*[^*]/.test(bulletStripped) && /\*\s*$/.test(bulletStripped)) {
      usageNotes.push(bulletStripped.replace(/^\*\s*/, '').replace(/\s*\*$/, ''));
      continue;
    }
    if (/^(?:brief\s+)?usage\s+note\b/i.test(bulletStripped)) {
      // "Brief usage note for the story example — ..." or "...:" → extract after dash or colon
      const noteText = bulletStripped.replace(/^(?:brief\s+)?usage\s+note[^—–:,-]*[—–:,-]\s*/i, '').trim();
      if (noteText) usageNotes.push(noteText);
      continue;
    }
    // Only collect lines that contain target script characters — skip English-only lines
    // For Latin-script languages (scriptRegex is null), accept all non-empty lines as examples
    if (scriptRegex && !scriptRegex.test(trimmed)) continue;
    const cleaned = stripExamplePrefix(trimmed);
    // Reject lines that look like usage notes / meta-commentary with only a few target chars
    // (e.g. "Shows how 深远 describes lasting impact" — mostly English with one target word)
    if (scriptRegex) {
      const targetCharCount = (cleaned.match(new RegExp(scriptRegex.source, 'g')) || []).length;
      const totalLength = cleaned.replace(/\s/g, '').length;
      if (totalLength > 0 && targetCharCount / totalLength < 0.3) continue;
    }
    if (examples.length < 2) examples.push(cleaned);
    else break;
  }

  return { examples, usageNotes };
}

// ── Comprehension question parser ─────────────────────────────

/**
 * Splits "question text (translation)" into { text, translation }.
 * Returns { text: qText, translation: '' } if no trailing parenthetical found.
 */
function splitQuestionTranslation(qText) {
  const m = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
  return m ? { text: m[1], translation: m[2] } : { text: qText, translation: '' };
}

/**
 * Tries to parse an "Answer: X" line at position j in lines array.
 * @param {string[]} lines
 * @param {number} j
 * @param {RegExp} valuePattern - regex for valid answer value (e.g. /[A-D]/ or /[TF]/)
 * @returns {{ answer: string|null, nextJ: number }}
 */
function parseAnswerLine(lines, j, valuePattern) {
  if (j < lines.length) {
    const ansLine = lines[j].trim();
    const ansMatch = ansLine.match(/^Answer:\s*(.+)/i);
    if (ansMatch) {
      const val = ansMatch[1].trim();
      const m = val.match(valuePattern);
      if (m) return { answer: m[0].toUpperCase(), nextJ: j + 1 };
    }
  }
  return { answer: null, nextJ: j };
}

function parseQuestions(text) {
  if (!text) return [];

  const questions = [];
  const lines = text.split('\n').map(l => l.trim());

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    // Strip leading number/bullet
    const cleaned = line.replace(/^[\d]+[.、)]\s*/, '').replace(/^[-•]\s*/, '').trim();
    if (!cleaned || cleaned.length <= 2) { i++; continue; }

    // Check for [MC] tag
    const mcMatch = cleaned.match(/^\[MC\]\s*(.*)/i);
    if (mcMatch) {
      const qText = mcMatch[1].trim();
      const options = [];
      let j = i + 1;
      while (j < lines.length && options.length < 4) {
        const optLine = lines[j].trim();
        const optMatch = optLine.match(/^([A-D])\.\s+(.*)/);
        if (optMatch) {
          options.push(`${optMatch[1]}. ${optMatch[2]}`);
          j++;
        } else {
          break;
        }
      }
      const { answer: correctAnswer, nextJ } = parseAnswerLine(lines, j, /[A-D]/);
      j = nextJ;
      const { text: qt, translation } = splitQuestionTranslation(qText);
      if (options.length === 4 && correctAnswer) {
        questions.push({ type: 'mc', text: qt, translation, options, correctAnswer });
      } else {
        questions.push({ type: 'fr', text: qt, translation });
      }
      i = j;
      continue;
    }

    // Check for [TF] tag
    const tfMatch = cleaned.match(/^\[TF\]\s*(.*)/i);
    if (tfMatch) {
      const qText = tfMatch[1].trim();
      let j = i + 1;
      const { answer: correctAnswer, nextJ } = parseAnswerLine(lines, j, /[TF]/);
      j = nextJ;
      const { text: qt, translation } = splitQuestionTranslation(qText);
      if (correctAnswer) {
        questions.push({ type: 'tf', text: qt, translation, correctAnswer });
      } else {
        questions.push({ type: 'fr', text: qt, translation });
      }
      i = j;
      continue;
    }

    // Check for [FB] tag
    const fbMatch = cleaned.match(/^\[FB\]\s*(.*)/i);
    if (fbMatch) {
      const qText = fbMatch[1].trim();
      let j = i + 1;
      const { answer: correctAnswer, nextJ } = parseAnswerLine(lines, j, /.+/);
      j = nextJ;
      // Look for Bank: line
      let bank = null;
      if (j < lines.length) {
        const bankLine = lines[j].trim();
        const bankMatch = bankLine.match(/^Bank:\s*(.+)/i);
        if (bankMatch) {
          bank = bankMatch[1].split(',').map(w => w.trim()).filter(Boolean);
          j++;
        }
      }
      const { text: qt, translation } = splitQuestionTranslation(qText);
      if (correctAnswer && bank && bank.length >= 2) {
        questions.push({ type: 'fb', text: qt, translation, correctAnswer, bank });
      } else {
        questions.push({ type: 'fr', text: qt, translation });
      }
      i = j;
      continue;
    }

    // Check for [VM] tag
    const vmMatch = cleaned.match(/^\[VM\]\s*(.*)/i);
    if (vmMatch) {
      const qText = vmMatch[1].trim();
      const pairs = [];
      let j = i + 1;
      while (j < lines.length) {
        const pairLine = lines[j].trim();
        const pairMatch = pairLine.match(/^\d+\.\s*(.+?)\s*=\s*(.+)/);
        if (pairMatch) {
          pairs.push({ word: pairMatch[1].trim(), definition: pairMatch[2].trim() });
          j++;
        } else {
          break;
        }
      }
      const { text: qt, translation } = splitQuestionTranslation(qText);
      if (pairs.length >= 2) {
        questions.push({ type: 'vm', text: qt, translation, pairs });
      } else {
        questions.push({ type: 'fr', text: qt, translation });
      }
      i = j;
      continue;
    }

    // Check for [FR] tag
    const frMatch = cleaned.match(/^\[FR\]\s*(.*)/i);
    if (frMatch) {
      const { text: qt, translation } = splitQuestionTranslation(frMatch[1].trim());
      questions.push({ type: 'fr', text: qt, translation });
      i++;
      continue;
    }

    // Legacy format (no tag) → FR
    const { text: qt, translation } = splitQuestionTranslation(cleaned);
    questions.push({ type: 'fr', text: qt, translation });
    i++;
  }

  return questions;
}

// ── Grammar notes parser ──────────────────────────────────────

function parseGrammarNotes(text) {
  if (!text) return [];
  const items = [];
  let match;

  // Helper: find first example line (bullet or story quote) in a block of text
  function findExample(block) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Prefer bullet lines
    const bullet = lines.find(l => /^[-•]/.test(l));
    if (bullet) return bullet.replace(/^[-•]\s*/, '');
    return lines[0] || '';
  }

  // Try formats in order of specificity:
  // 1. **Pattern** (Label) — explanation  (canonical format)
  const canonicalPattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*[-–—:：]\s*([^\n]+)/g;
  while ((match = canonicalPattern.exec(text)) !== null) {
    const afterHeader = text.slice(match.index + match[0].length);
    items.push({
      pattern:     match[1].trim(),
      label:       match[2].trim(),
      explanation: match[3].trim(),
      example:     findExample(afterHeader),
    });
  }
  if (items.length > 0) return items;

  // 2. **Pattern (Label)** — explanation  (parenthetical inside bold, dash after)
  const insideBoldPattern = /\*\*([^*]+?)\s*\(([^)]+)\)\*\*\s*[-–—:：]\s*([^\n]+)/g;
  while ((match = insideBoldPattern.exec(text)) !== null) {
    const afterHeader = text.slice(match.index + match[0].length);
    items.push({
      pattern:     match[1].trim(),
      label:       match[2].trim(),
      explanation: match[3].trim(),
      example:     findExample(afterHeader),
    });
  }
  if (items.length > 0) return items;

  // 3. **Pattern** — explanation  (no parenthetical, single-line)
  const noLabelPattern = /\*\*([^*]+)\*\*\s*[-–—:：]\s*([^\n]+)/g;
  while ((match = noLabelPattern.exec(text)) !== null) {
    const afterHeader = text.slice(match.index + match[0].length);
    items.push({
      pattern:     match[1].trim(),
      label:       '',
      explanation: match[2].trim(),
      example:     findExample(afterHeader),
    });
  }
  if (items.length > 0) return items;

  // 4. **Heading** as standalone bold line, followed by paragraph explanation
  //    Handles: **Pattern (Label)** or **Pattern** on its own line with no dash
  //    Splits on bold headings and extracts explanation from the paragraph body
  const headingBlocks = text.split(/(?=(?:^|\n)\s*(?:\d+\.\s*)?\*\*)/);
  for (const block of headingBlocks) {
    const headMatch = block.match(/^\s*(?:\d+\.\s*)?\*\*([^*]+)\*\*\s*\n([\s\S]*)/);
    if (!headMatch) continue;
    const heading = headMatch[1].trim();
    const body = headMatch[2].trim();
    if (!body) continue;

    // Extract optional parenthetical from the heading: "Pattern (Label)" or "Pattern — Label"
    let pattern = heading, label = '';
    const parenMatch = heading.match(/^(.+?)\s*\(([^)]+)\)$/);
    const dashMatch = heading.match(/^(.+?)\s*[-–—:：]\s*(.+)$/);
    if (parenMatch) {
      pattern = parenMatch[1].trim();
      label = parenMatch[2].trim();
    } else if (dashMatch) {
      pattern = dashMatch[1].trim();
      label = dashMatch[2].trim();
    }

    // First non-empty line of body is the explanation
    const bodyLines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const explanation = bodyLines[0] || '';
    const exampleBlock = bodyLines.slice(1).join('\n');
    items.push({ pattern, label, explanation, example: findExample(exampleBlock || body) });
  }
  return items;
}

// ── Story text rendering helpers ──────────────────────────────

/**
 * Converts markdown bold (**word**) and italic (*word*) in story text
 * to React-safe HTML string segments.
 * Returns an array of { type: 'text'|'bold'|'italic', content: string }
 */
export function parseStorySegments(storyText) {
  if (!storyText) return [];

  const segments = [];
  // Match **bold** or *italic* or plain text
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|[^*]+)/g;
  let m;

  while ((m = pattern.exec(storyText)) !== null) {
    if (m[2] !== undefined) {
      segments.push({ type: 'bold', content: m[2] });
    } else if (m[3] !== undefined) {
      segments.push({ type: 'italic', content: m[3] });
    } else {
      segments.push({ type: 'text', content: m[0] });
    }
  }

  return segments;
}

// ── Structured output normalizer ─────────────────────────────

/**
 * Converts a structured JSON reader response (from tool use / json_schema)
 * into the same shape as parseReaderResponse returns.
 */
export function normalizeStructuredReader(rawJson, langId = DEFAULT_LANG_ID) {
  let data;
  try {
    data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    // Fallback to regex parser if JSON is invalid
    return parseReaderResponse(rawJson, langId);
  }

  const vocabulary = (data.vocabulary || []).map(normalizeVocabEntry);
  const ankiJson = synthesizeAnkiJson(vocabulary);

  const questions = (data.questions || []).map(q => ({
    type:          q.type || 'fr',
    text:          q.text || '',
    translation:   q.translation || '',
    ...(q.options ? { options: q.options } : {}),
    ...(q.correctAnswer || q.correct_answer ? { correctAnswer: q.correctAnswer || q.correct_answer } : {}),
    ...(q.pairs ? { pairs: q.pairs } : {}),
    ...(q.bank ? { bank: q.bank } : {}),
  }));

  const grammarNotes = (data.grammar_notes || []).map(n => ({
    pattern:     n.pattern || '',
    label:       n.label || '',
    explanation: n.explanation || '',
    example:     n.example || '',
  }));

  return {
    raw:              typeof rawJson === 'string' ? rawJson : JSON.stringify(data),
    titleZh:          data.title_target || '',
    titleEn:          data.title_en || '',
    story:            data.story || '',
    vocabulary,
    questions,
    ankiJson,
    grammarNotes,
    suggestedTopics:  data.suggested_topics || [],
    parseError:       null,
    langId,
  };
}
