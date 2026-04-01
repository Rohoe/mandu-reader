/**
 * Grammar cloze utility — extracts functional cores from grammar patterns
 * and blanks them in example sentences.
 */

/**
 * Strip placeholder tokens (V, N, Adj, +, …, etc.) from a pattern to get functional cores.
 * e.g. "V + 到" → ["到"], "把…V了" → ["把", "了"], "-는 것" → ["는 것"]
 */
function extractCores(pattern) {
  // Remove common placeholders and connectors
  // Use non-word-boundary-aware removal for CJK compatibility
  let cleaned = pattern
    .replace(/(^|(?<=[\s+…\u2026\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]))(V|N|Adj|Adv|noun|verb|adj)(?=$|[\s+…\u2026\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af])/gi, '')
    .replace(/[+…\u2026]/g, ' ')
    .replace(/\.{2,}/g, ' ')  // Convert ... to space (e.g. ne...pas → ne pas)
    .replace(/[()（）\[\]]/g, '')
    .replace(/-(?=\S)/g, '')  // Strip leading dashes (Korean patterns like -는)
    .trim();

  // Split on whitespace and filter out empty tokens
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
  return parts;
}

/**
 * Generate a cloze exercise from a grammar pattern and example sentence.
 * Blanks the functional cores of the pattern in the example.
 *
 * @param {string} pattern - Grammar pattern (e.g. "V + 到", "把…V了", "-는 것")
 * @param {string} example - Example sentence containing the pattern
 * @returns {{ blankedSentence: string, answers: string[], matchFound: boolean }}
 */
export function generateGrammarCloze(pattern, example) {
  if (!pattern || !example) {
    return { blankedSentence: example || '', answers: [], matchFound: false };
  }

  const cores = extractCores(pattern);
  if (cores.length === 0) {
    return { blankedSentence: example, answers: [], matchFound: false };
  }

  let blanked = example;
  const answers = [];
  let matchFound = false;

  for (const core of cores) {
    if (blanked.includes(core)) {
      blanked = blanked.replace(core, '____');
      answers.push(core);
      matchFound = true;
    }
  }

  // Fallback: if no cores matched, try matching the whole cleaned pattern
  if (!matchFound) {
    const wholeCleaned = pattern
      .replace(/\b(V|N|Adj|Adv|noun|verb|adj)\b/gi, '')
      .replace(/[+…\u2026()（）\[\]]/g, '')
      .trim();
    if (wholeCleaned && blanked.includes(wholeCleaned)) {
      blanked = blanked.replace(wholeCleaned, '____');
      answers.push(wholeCleaned);
      matchFound = true;
    }
  }

  return { blankedSentence: blanked, answers, matchFound };
}
