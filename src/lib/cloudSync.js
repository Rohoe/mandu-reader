import { supabase } from './supabase';
import { DEMO_READER_KEYS } from './demoReader';

/**
 * Returns the authenticated Supabase user, or throws if not signed in.
 */
async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signInWithApple() {
  return supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Pushes all metadata (syllabi, progress, vocab, etc.) — excludes readers.
// Readers are pushed individually via pushReaderToCloud when generated.
export async function pushToCloud(state) {
  const user = await getAuthUser();
  // Filter out demo/sample readers so they never get synced to cloud
  const standaloneReaders = (state.standaloneReaders || []).filter(r => !r.isDemo && !DEMO_READER_KEYS.has(r.key));
  const { error } = await supabase.from('user_data').upsert({
    user_id:            user.id,
    syllabi:            state.syllabi,
    syllabus_progress:  state.syllabusProgress,
    standalone_readers: standaloneReaders,
    learned_vocabulary: state.learnedVocabulary,
    learned_grammar:    state.learnedGrammar,
    exported_words:     [...state.exportedWords],
    updated_at:         new Date().toISOString(),
  });
  if (error) throw error;
}

// Serialize concurrent reader pushes to prevent read-modify-write races.
let _readerSyncQueue = Promise.resolve();

// Merges a single newly-generated reader into the cloud row (read-then-write).
export function pushReaderToCloud(lessonKey, readerData) {
  _readerSyncQueue = _readerSyncQueue.then(() => _pushReaderToCloudImpl(lessonKey, readerData)).catch(err => { console.warn('[cloudSync] pushReaderToCloud failed:', err.message || err); });
  return _readerSyncQueue;
}

async function _pushReaderToCloudImpl(lessonKey, readerData) {
  const user = await getAuthUser();
  const { data } = await supabase
    .from('user_data')
    .select('generated_readers')
    .eq('user_id', user.id)
    .single();
  const existing = data?.generated_readers ?? {};
  const { error } = await supabase.from('user_data').upsert({
    user_id:           user.id,
    generated_readers: { ...existing, [lessonKey]: readerData },
    updated_at:        new Date().toISOString(),
  });
  if (error) throw error;
}

export async function pullFromCloud() {
  const user = await getAuthUser();
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no row found
  return data; // null if first sync
}

// Fetch just the reader keys from cloud (for eviction verification)
export async function fetchCloudReaderKeys() {
  let user;
  try { user = await getAuthUser(); } catch { return null; }
  const { data, error } = await supabase
    .from('user_data')
    .select('generated_readers')
    .eq('user_id', user.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return new Set(); // no row
    throw error;
  }
  return new Set(Object.keys(data?.generated_readers ?? {}));
}

// Pull a single reader from cloud by lesson key
export async function pullReaderFromCloud(lessonKey) {
  let user;
  try { user = await getAuthUser(); } catch { return null; }
  const { data, error } = await supabase
    .from('user_data')
    .select('generated_readers')
    .eq('user_id', user.id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data?.generated_readers?.[lessonKey] ?? null;
}

// Simple hash function for conflict detection
function hashData(data) {
  const str = JSON.stringify({
    syllabi: data.syllabi,
    syllabusProgress: data.syllabusProgress,
    standaloneReaders: data.standaloneReaders,
    learnedVocabulary: data.learnedVocabulary,
    learnedGrammar: data.learnedGrammar,
    exportedWords: data.exportedWords,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export function detectConflict(localState, cloudData) {
  if (!cloudData) return null; // No cloud data, no conflict

  const localHash = hashData({
    syllabi: localState.syllabi,
    syllabusProgress: localState.syllabusProgress,
    standaloneReaders: localState.standaloneReaders,
    learnedVocabulary: localState.learnedVocabulary,
    learnedGrammar: localState.learnedGrammar,
    exportedWords: localState.exportedWords,
  });

  const cloudHash = hashData({
    syllabi: cloudData.syllabi,
    syllabusProgress: cloudData.syllabus_progress,
    standaloneReaders: cloudData.standalone_readers,
    learnedVocabulary: cloudData.learned_vocabulary,
    learnedGrammar: cloudData.learned_grammar,
    exportedWords: cloudData.exported_words,
  });

  if (localHash === cloudHash) return null; // Data is identical

  const cloudTs = new Date(cloudData.updated_at).getTime();
  const localTs = localState.lastModified;

  return {
    cloudNewer: cloudTs > localTs,
    cloudDate: new Date(cloudTs).toLocaleString(),
    localDate: new Date(localTs).toLocaleString(),
    cloudSyllabusCount: cloudData.syllabi?.length || 0,
    localSyllabusCount: localState.syllabi?.length || 0,
    cloudStandaloneCount: cloudData.standalone_readers?.length || 0,
    localStandaloneCount: localState.standaloneReaders?.length || 0,
    cloudVocabCount: Object.keys(cloudData.learned_vocabulary || {}).length,
    localVocabCount: Object.keys(localState.learnedVocabulary || {}).length,
    cloudGrammarCount: Object.keys(cloudData.learned_grammar || {}).length,
    localGrammarCount: Object.keys(localState.learnedGrammar || {}).length,
  };
}

// Union-merge local state and cloud data. Returns cloud-row shaped data
// suitable for HYDRATE_FROM_CLOUD / MERGE_WITH_CLOUD.
export function mergeData(localState, cloudData) {
  // Syllabi: union by id
  const syllabusMap = new Map();
  for (const s of (cloudData.syllabi || [])) syllabusMap.set(s.id, s);
  for (const s of (localState.syllabi || [])) syllabusMap.set(s.id, s); // local wins on conflict
  const syllabi = [...syllabusMap.values()];

  // Standalone readers: union by key (exclude demo/sample readers)
  const standaloneMap = new Map();
  for (const r of (cloudData.standalone_readers || [])) {
    if (!DEMO_READER_KEYS.has(r.key)) standaloneMap.set(r.key, r);
  }
  for (const r of (localState.standaloneReaders || [])) {
    if (!r.isDemo && !DEMO_READER_KEYS.has(r.key)) standaloneMap.set(r.key, r);
  }
  const standalone_readers = [...standaloneMap.values()];

  // Syllabus progress: union by syllabus ID; merge completedLessons + max lessonIndex
  const syllabus_progress = { ...(cloudData.syllabus_progress || {}) };
  for (const [id, local] of Object.entries(localState.syllabusProgress || {})) {
    const cloud = syllabus_progress[id];
    if (!cloud) {
      syllabus_progress[id] = local;
    } else {
      const mergedCompleted = [...new Set([...(cloud.completedLessons || []), ...(local.completedLessons || [])])];
      syllabus_progress[id] = {
        lessonIndex: Math.max(cloud.lessonIndex || 0, local.lessonIndex || 0),
        completedLessons: mergedCompleted,
      };
    }
  }

  // Generated readers: union by lesson key; local wins (has user answers, grading)
  // Exclude demo reader keys from merge
  const cloudGenerated = { ...(cloudData.generated_readers || {}) };
  const localGenerated = { ...(localState.generatedReaders || {}) };
  for (const key of DEMO_READER_KEYS) {
    delete cloudGenerated[key];
    delete localGenerated[key];
  }
  const generated_readers = {
    ...cloudGenerated,
    ...localGenerated,
  };

  // Learned vocabulary: union by word; prefer newer dateAdded
  const learned_vocabulary = { ...(cloudData.learned_vocabulary || {}) };
  for (const [word, local] of Object.entries(localState.learnedVocabulary || {})) {
    const cloud = learned_vocabulary[word];
    if (!cloud) {
      learned_vocabulary[word] = local;
    } else {
      const localDate = local.dateAdded || 0;
      const cloudDate = cloud.dateAdded || 0;
      learned_vocabulary[word] = localDate >= cloudDate ? local : cloud;
    }
  }

  // Learned grammar: union by key; prefer newer dateAdded
  const learned_grammar = { ...(cloudData.learned_grammar || {}) };
  for (const [key, local] of Object.entries(localState.learnedGrammar || {})) {
    const cloud = learned_grammar[key];
    if (!cloud) {
      learned_grammar[key] = local;
    } else {
      const localDate = local.dateAdded || 0;
      const cloudDate = cloud.dateAdded || 0;
      learned_grammar[key] = localDate >= cloudDate ? local : cloud;
    }
  }

  // Exported words: set union
  const cloudExported = Array.isArray(cloudData.exported_words) ? cloudData.exported_words : [];
  const localExported = localState.exportedWords instanceof Set
    ? [...localState.exportedWords]
    : Array.isArray(localState.exportedWords) ? localState.exportedWords : [];
  const exported_words = [...new Set([...cloudExported, ...localExported])];

  return {
    syllabi,
    syllabus_progress,
    standalone_readers,
    generated_readers,
    learned_vocabulary,
    learned_grammar,
    exported_words,
    updated_at: new Date().toISOString(),
  };
}

// Compute a human-readable summary of what changed during a merge.
// preState: local state before merge (app state shape)
// postMerged: merged result (cloud-row shape from mergeData)
export function computeMergeSummary(preState, postMerged) {
  const parts = [];

  const syllabiDiff = (postMerged.syllabi?.length || 0) - (preState.syllabi?.length || 0);
  if (syllabiDiff > 0) parts.push(`+${syllabiDiff} ${syllabiDiff === 1 ? 'syllabus' : 'syllabi'}`);

  const standaloneDiff = (postMerged.standalone_readers?.length || 0) - (preState.standaloneReaders?.length || 0);
  if (standaloneDiff > 0) parts.push(`+${standaloneDiff} ${standaloneDiff === 1 ? 'reader' : 'readers'}`);

  const vocabDiff = Object.keys(postMerged.learned_vocabulary || {}).length - Object.keys(preState.learnedVocabulary || {}).length;
  if (vocabDiff > 0) parts.push(`+${vocabDiff} vocab ${vocabDiff === 1 ? 'word' : 'words'}`);

  const grammarDiff = Object.keys(postMerged.learned_grammar || {}).length - Object.keys(preState.learnedGrammar || {}).length;
  if (grammarDiff > 0) parts.push(`+${grammarDiff} grammar ${grammarDiff === 1 ? 'pattern' : 'patterns'}`);

  if (parts.length > 0) return `Synced from cloud: ${parts.join(', ')}`;
  return 'Synced from cloud (content updated)';
}

// Push pre-merged data to cloud (includes generated_readers).
export async function pushMergedToCloud(mergedData) {
  const user = await getAuthUser();
  // Filter out demo/sample readers before pushing to cloud
  const standaloneReaders = (mergedData.standalone_readers || []).filter(r => !r.isDemo && !DEMO_READER_KEYS.has(r.key));
  const generatedReaders = { ...(mergedData.generated_readers || {}) };
  for (const key of DEMO_READER_KEYS) delete generatedReaders[key];
  const { error } = await supabase.from('user_data').upsert({
    user_id:            user.id,
    syllabi:            mergedData.syllabi,
    syllabus_progress:  mergedData.syllabus_progress,
    standalone_readers: standaloneReaders,
    generated_readers:  generatedReaders,
    learned_vocabulary: mergedData.learned_vocabulary,
    learned_grammar:    mergedData.learned_grammar,
    exported_words:     mergedData.exported_words,
    updated_at:         mergedData.updated_at || new Date().toISOString(),
  });
  if (error) throw error;
}
