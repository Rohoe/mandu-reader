/**
 * Builds a syllabus prompt for a Learning Path unit, injecting cumulative
 * context (covered vocab/topics/grammar) to prevent overlap between units.
 *
 * For 'narrative' style units, delegates to the narrative syllabus prompt.
 * For 'thematic' and 'exploratory' units, wraps the standard syllabus prompt.
 */

import { buildSyllabusPrompt } from './syllabusPrompt';
import { buildNarrativeSyllabusPrompt } from './narrativeSyllabusPrompt';

export function buildPathUnitSyllabusPrompt(langConfig, unit, pathContext, level, lessonCount, nativeLangName = 'English', { learnerProfile } = {}) {
  const overlapSection = buildOverlapSection(pathContext);

  if (unit.style === 'narrative' && unit.sourceMaterial) {
    // Use narrative prompt with overlap context injected
    const basePrompt = buildNarrativeSyllabusPrompt(
      langConfig,
      unit.sourceMaterial,
      'historical', // narrative units default to historical; could be refined
      level,
      lessonCount,
      nativeLangName,
      { learnerProfile }
    );
    return injectOverlapContext(basePrompt, overlapSection);
  }

  // Thematic or exploratory: use standard prompt with overlap context
  const basePrompt = buildSyllabusPrompt(
    langConfig,
    unit.title, // use unit title as the topic
    level,
    lessonCount,
    nativeLangName,
    { learnerProfile, recentTopics: [] }
  );

  const unitContext = `\n## Unit Context (from Learning Path: "${pathContext.pathTitle}")
This is unit ${unit.unitIndex + 1} of a larger learning path.
Unit focus: ${unit.description}
Style: ${unit.style}${unit.vocabThemes.length > 0 ? `\nVocabulary themes to emphasize: ${unit.vocabThemes.join(', ')}` : ''}
`;

  return injectOverlapContext(basePrompt, overlapSection + unitContext);
}

function buildOverlapSection(pathContext) {
  const parts = [];

  if (pathContext.coveredVocab?.length > 0) {
    // Send up to 200 words to avoid excessive prompt length
    const words = pathContext.coveredVocab.slice(0, 200);
    parts.push(`Vocabulary already taught in earlier units (DO NOT repeat these words as vocabulary_focus items):\n${words.join(', ')}`);
  }

  if (pathContext.coveredTopics?.length > 0) {
    parts.push(`Topics already covered (choose different angles if touching similar themes):\n${pathContext.coveredTopics.join('; ')}`);
  }

  if (pathContext.coveredGrammar?.length > 0) {
    const patterns = pathContext.coveredGrammar.slice(0, 50);
    parts.push(`Grammar patterns already taught: ${patterns.join(', ')}`);
  }

  if (parts.length === 0) return '';
  return '\n## Overlap Prevention (Learning Path Context)\n' + parts.join('\n\n') + '\n';
}

function injectOverlapContext(prompt, contextToInject) {
  if (!contextToInject) return prompt;
  // Insert before the final "Return ONLY valid JSON" instruction
  const marker = 'Return ONLY valid JSON.';
  const idx = prompt.lastIndexOf(marker);
  if (idx === -1) return prompt + '\n' + contextToInject;
  return prompt.slice(0, idx) + contextToInject + '\n' + prompt.slice(idx);
}
