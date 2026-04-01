/**
 * Learning Path import/export schema and validation.
 *
 * Import format is designed to be LLM-friendly: users can paste a prompt into
 * any LLM and import the JSON output. Validation is lenient but ensures
 * structural integrity.
 */

export const SCHEMA_VERSION = 1;

/**
 * Validate and normalize an imported learning path JSON object.
 * Returns { valid: true, path } or { valid: false, errors: string[] }.
 */
export function validateImportedPath(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be a JSON object'] };
  }

  // Accept both wrapped { version, type, path } and bare path objects
  const pathData = data.path || data;

  if (!pathData.title || typeof pathData.title !== 'string') {
    errors.push('Missing or invalid "title" (string required)');
  }
  const langId = pathData.langId || pathData.lang_id;
  if (!langId || typeof langId !== 'string') {
    errors.push('Missing or invalid "langId" (string required)');
  }
  if (pathData.level == null || typeof pathData.level !== 'number') {
    errors.push('Missing or invalid "level" (number required)');
  }
  if (!Array.isArray(pathData.units) || pathData.units.length === 0) {
    errors.push('Missing or empty "units" array');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate and normalize each unit
  const units = pathData.units.map((u, i) => {
    if (!u.title || typeof u.title !== 'string') {
      errors.push(`Unit ${i + 1}: missing or invalid "title"`);
    }
    if (!u.description || typeof u.description !== 'string') {
      errors.push(`Unit ${i + 1}: missing or invalid "description"`);
    }
    return normalizeUnit(u, i);
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    path: normalizePath(pathData, units),
  };
}

function normalizeUnit(u, index) {
  return {
    unitIndex: index,
    title: u.title,
    description: u.description,
    estimatedLessons: u.estimatedLessons || u.estimated_lessons || 8,
    style: normalizeStyle(u.style),
    vocabThemes: u.vocabThemes || u.vocab_themes || [],
    sourceMaterial: u.sourceMaterial || u.source_material || null,
    syllabusId: null,
    status: 'pending',
  };
}

function normalizeStyle(style) {
  const valid = ['thematic', 'narrative', 'exploratory'];
  return valid.includes(style) ? style : 'thematic';
}

function normalizePath(data, units) {
  return {
    id: `path_${Date.now().toString(36)}`,
    title: data.title,
    description: data.description || '',
    langId: data.langId || data.lang_id,
    level: data.level,
    nativeLang: data.nativeLang || data.native_lang || 'en',
    profile: data.profile || null,
    units,
    coveredVocab: [],
    coveredTopics: [],
    coveredGrammar: [],
    continuationContext: data.continuationContext || data.continuation_context || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
  };
}

/**
 * Build the export JSON for a learning path (for file download).
 */
export function exportPath(path) {
  return {
    version: SCHEMA_VERSION,
    type: 'learning_path',
    path: {
      title: path.title,
      description: path.description,
      langId: path.langId,
      level: path.level,
      nativeLang: path.nativeLang,
      profile: path.profile,
      units: path.units.map(u => ({
        title: u.title,
        description: u.description,
        estimatedLessons: u.estimatedLessons,
        style: u.style,
        vocabThemes: u.vocabThemes,
        sourceMaterial: u.sourceMaterial,
      })),
      continuationContext: path.continuationContext,
    },
  };
}

/**
 * Create a new empty Learning Path object from wizard profile data.
 */
export function createLearningPath({ title, description, langId, level, nativeLang, profile, units, continuationContext }) {
  return {
    id: `path_${Date.now().toString(36)}`,
    title,
    description: description || '',
    langId,
    level,
    nativeLang: nativeLang || 'en',
    profile: profile || null,
    units: (units || []).map((u, i) => ({
      unitIndex: i,
      title: u.title,
      description: u.description,
      estimatedLessons: u.estimatedLessons || u.estimated_lessons || 8,
      style: normalizeStyle(u.style),
      vocabThemes: u.vocabThemes || u.vocab_themes || [],
      sourceMaterial: u.sourceMaterial || u.source_material || null,
      syllabusId: null,
      status: 'pending',
    })),
    coveredVocab: [],
    coveredTopics: [],
    coveredGrammar: [],
    continuationContext: continuationContext || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
  };
}
