/**
 * Parses Claude's markdown response into structured data.
 * All functions return sensible defaults on parse failure.
 */

import { getLang, DEFAULT_LANG_ID } from './languages';

// ── Default result shape ──────────────────────────────────────

const EMPTY_RESULT = Object.freeze({
  raw:            '',
  titleZh:        '',
  titleEn:        '',
  story:          '',
  vocabulary:     [],
  questions:      [],
  ankiJson:       [],
  grammarNotes:   [],
  parseWarnings:  [],
  parseError:     null,
  langId:         DEFAULT_LANG_ID,
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

function extractVocabularySection(rawText, scriptRegex) {
  const vocabSectionMatch = rawText.match(
    /#{2,4}\s*(?:3\.[^\n]*|(?:Vocabulary|词汇|어휘)[^\n]*)\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:4\.|Questions|理解|Comprehension|이해|```anki-json)|```anki-json|$)/i
  );
  if (vocabSectionMatch) {
    return parseVocabularySection(vocabSectionMatch[1], scriptRegex);
  }
  return [];
}

function extractComprehensionQuestions(rawText) {
  const questionsSectionMatch = rawText.match(
    /#{2,4}\s*(?:4\.[^\n]*|(?:Questions|Comprehension|理解|이해)[^\n]*)\s*\n+([\s\S]*?)(?=#{2,4}\s*(?:5\.|Anki|anki)|```anki-json|$)/i
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
    } catch {
      return [];
    }
  }
  return [];
}

function extractGrammarNotes(rawText) {
  const grammarSectionMatch = rawText.match(
    /#{2,4}\s*(?:6\.[^\n]*|(?:Grammar|语法|문법)[^\n]*)\s*\n+([\s\S]*?)(?=#{2,4}\s*7\.|$)/i
  );
  if (grammarSectionMatch) {
    return parseGrammarNotes(grammarSectionMatch[1]);
  }
  return [];
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
    const vocabulary = extractVocabularySection(rawText, scriptRegex);
    const questions = extractComprehensionQuestions(rawText);
    const ankiJson = extractAnkiJson(rawText);
    const grammarNotes = extractGrammarNotes(rawText);
    const enrichedVocabulary = enrichVocabularyWithAnki(vocabulary, ankiJson, langConfig);

    return {
      raw: rawText,
      titleZh, titleEn, story,
      vocabulary: enrichedVocabulary,
      questions, ankiJson, grammarNotes,
      parseWarnings: [...titleWarnings, ...storyWarnings],
      parseError: null,
      langId,
    };
  } catch (err) {
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
      // Try to consume A./B./C./D. option lines and Answer: line
      const options = [];
      let correctAnswer = null;
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
      // Look for Answer: line
      if (j < lines.length) {
        const ansLine = lines[j].trim();
        const ansMatch = ansLine.match(/^Answer:\s*([A-D])/i);
        if (ansMatch) {
          correctAnswer = ansMatch[1].toUpperCase();
          j++;
        }
      }
      // Valid MC needs 4 options and a correct answer; otherwise fallback to FR
      if (options.length === 4 && correctAnswer) {
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'mc',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
          options,
          correctAnswer,
        });
      } else {
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'fr',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
        });
      }
      i = j;
      continue;
    }

    // Check for [TF] tag
    const tfMatch = cleaned.match(/^\[TF\]\s*(.*)/i);
    if (tfMatch) {
      const qText = tfMatch[1].trim();
      let correctAnswer = null;
      let j = i + 1;
      if (j < lines.length) {
        const ansLine = lines[j].trim();
        const ansMatch = ansLine.match(/^Answer:\s*([TF])/i);
        if (ansMatch) {
          correctAnswer = ansMatch[1].toUpperCase();
          j++;
        }
      }
      if (correctAnswer) {
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'tf',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
          correctAnswer,
        });
      } else {
        // Malformed TF → fallback to FR
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'fr',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
        });
      }
      i = j;
      continue;
    }

    // Check for [FB] tag
    const fbMatch = cleaned.match(/^\[FB\]\s*(.*)/i);
    if (fbMatch) {
      const qText = fbMatch[1].trim();
      let correctAnswer = null;
      let bank = null;
      let j = i + 1;
      // Look for Answer: line
      if (j < lines.length) {
        const ansLine = lines[j].trim();
        const ansMatch = ansLine.match(/^Answer:\s*(.+)/i);
        if (ansMatch) {
          correctAnswer = ansMatch[1].trim();
          j++;
        }
      }
      // Look for Bank: line
      if (j < lines.length) {
        const bankLine = lines[j].trim();
        const bankMatch = bankLine.match(/^Bank:\s*(.+)/i);
        if (bankMatch) {
          bank = bankMatch[1].split(',').map(w => w.trim()).filter(Boolean);
          j++;
        }
      }
      if (correctAnswer && bank && bank.length >= 2) {
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'fb',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
          correctAnswer,
          bank,
        });
      } else {
        // Malformed FB → fallback to FR
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'fr',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
        });
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
      if (pairs.length >= 2) {
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'vm',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
          pairs,
        });
      } else {
        // Malformed VM → fallback to FR
        const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
        questions.push({
          type: 'fr',
          text: transMatch ? transMatch[1] : qText,
          translation: transMatch ? transMatch[2] : '',
        });
      }
      i = j;
      continue;
    }

    // Check for [FR] tag
    const frMatch = cleaned.match(/^\[FR\]\s*(.*)/i);
    if (frMatch) {
      const qText = frMatch[1].trim();
      const transMatch = qText.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
      if (transMatch) {
        questions.push({ type: 'fr', text: transMatch[1], translation: transMatch[2] });
      } else {
        questions.push({ type: 'fr', text: qText, translation: '' });
      }
      i++;
      continue;
    }

    // Legacy format (no tag) → FR
    const transMatch = cleaned.match(/^(.*?\S)\s*\(([^)]+)\)\s*$/);
    if (transMatch) {
      questions.push({ type: 'fr', text: transMatch[1], translation: transMatch[2] });
    } else {
      questions.push({ type: 'fr', text: cleaned, translation: '' });
    }
    i++;
  }

  return questions;
}

// ── Grammar notes parser ──────────────────────────────────────

function parseGrammarNotes(text) {
  if (!text) return [];
  const items = [];
  // Match: **Pattern** (English name) — explanation  (also accepts colon as separator)
  const headerPattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*[-–—:：]\s*([^\n]+)/g;
  let match;
  while ((match = headerPattern.exec(text)) !== null) {
    const pattern     = match[1].trim();
    const label       = match[2].trim();
    const explanation = match[3].trim();
    // Next non-empty line after the header is the example
    const afterHeader = text.slice(match.index + match[0].length);
    const exampleLine = afterHeader.split('\n').map(l => l.trim()).find(l => l.length > 0) || '';
    items.push({ pattern, label, explanation, example: exampleLine.replace(/^[-•]\s*/, '') });
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

  const vocabulary = (data.vocabulary || []).map(v => ({
    target:       v.target || v.word || v.chinese || v.korean || '',
    chinese:      v.target || v.word || v.chinese || '',
    korean:       v.korean || v.target || v.word || '',
    romanization: v.romanization || v.pinyin || v.jyutping || '',
    pinyin:       v.romanization || v.pinyin || '',
    translation:  v.translation || v.english || v.definition || '',
    english:      v.translation || v.english || v.definition || '',
    exampleStory:             v.example_story || '',
    exampleStoryTranslation:  v.example_story_translation || '',
    usageNoteStory:           v.usage_note_story || '',
    exampleExtra:             v.example_extra || '',
    exampleExtraTranslation:  v.example_extra_translation || '',
    usageNoteExtra:           v.usage_note_extra || '',
  }));

  const ankiJson = vocabulary.map(v => ({
    chinese:      v.target,
    korean:       v.target,
    target:       v.target,
    pinyin:       v.romanization,
    romanization: v.romanization,
    english:      v.translation,
    translation:  v.translation,
    example_story:             v.exampleStory,
    example_story_translation: v.exampleStoryTranslation,
    usage_note_story:          v.usageNoteStory,
    example_extra:             v.exampleExtra,
    example_extra_translation: v.exampleExtraTranslation,
    usage_note_extra:          v.usageNoteExtra,
  }));

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
    raw:          typeof rawJson === 'string' ? rawJson : JSON.stringify(data),
    titleZh:      data.title_target || '',
    titleEn:      data.title_en || '',
    story:        data.story || '',
    vocabulary,
    questions,
    ankiJson,
    grammarNotes,
    parseError:   null,
    langId,
  };
}
