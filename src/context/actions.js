/**
 * Action creator helpers — separate file so fast-refresh only affects components.
 */
import * as T from './actionTypes';

export function actions(dispatch) {
  return {
    setApiKey:             key    => dispatch({ type: T.SET_API_KEY, payload: key }),
    clearApiKey:           ()     => dispatch({ type: T.CLEAR_API_KEY }),
    setProviderKey:        (provider, key) => dispatch({ type: T.SET_PROVIDER_KEY, payload: { provider, key } }),
    setActiveProvider:     id     => dispatch({ type: T.SET_ACTIVE_PROVIDER, payload: id }),
    setActiveModel:        (provider, model) => dispatch({ type: T.SET_ACTIVE_MODEL, payload: { provider, model } }),
    setGradingModel:       (provider, model) => dispatch({ type: T.SET_GRADING_MODEL, payload: { provider, model } }),
    setCustomBaseUrl:      url    => dispatch({ type: T.SET_CUSTOM_BASE_URL, payload: url }),
    setCustomModelName:    name   => dispatch({ type: T.SET_CUSTOM_MODEL_NAME, payload: name }),
    setCompatPreset:       preset => dispatch({ type: T.SET_COMPAT_PRESET, payload: preset }),
    // Syllabi
    addSyllabus:           s      => dispatch({ type: T.ADD_SYLLABUS, payload: s }),
    removeSyllabus:        id     => dispatch({ type: T.REMOVE_SYLLABUS, payload: id }),
    extendSyllabusLessons: (id, newLessons, consumeSegments) => dispatch({ type: T.EXTEND_SYLLABUS_LESSONS, payload: { id, newLessons, consumeSegments } }),
    setLessonIndex:        (syllabusId, lessonIndex) => dispatch({ type: T.SET_LESSON_INDEX, payload: { syllabusId, lessonIndex } }),
    markLessonComplete:    (syllabusId, lessonIndex) => dispatch({ type: T.MARK_LESSON_COMPLETE, payload: { syllabusId, lessonIndex } }),
    unmarkLessonComplete:  (syllabusId, lessonIndex) => dispatch({ type: T.UNMARK_LESSON_COMPLETE, payload: { syllabusId, lessonIndex } }),
    // Standalone readers
    addStandaloneReader:   meta   => dispatch({ type: T.ADD_STANDALONE_READER, payload: meta }),
    removeStandaloneReader:key    => dispatch({ type: T.REMOVE_STANDALONE_READER, payload: key }),
    updateStandaloneReaderMeta: meta => dispatch({ type: T.UPDATE_STANDALONE_READER_META, payload: meta }),
    // Archive
    archiveSyllabus:            id  => dispatch({ type: T.ARCHIVE_SYLLABUS, payload: id }),
    unarchiveSyllabus:          id  => dispatch({ type: T.UNARCHIVE_SYLLABUS, payload: id }),
    archiveStandaloneReader:    key => dispatch({ type: T.ARCHIVE_STANDALONE_READER, payload: key }),
    unarchiveStandaloneReader:  key => dispatch({ type: T.UNARCHIVE_STANDALONE_READER, payload: key }),
    // Reader cache
    setReader:             (k, d) => dispatch({ type: T.SET_READER, payload: { lessonKey: k, data: d } }),
    clearReader:           k      => dispatch({ type: T.CLEAR_READER, payload: k }),
    touchReader:           k      => dispatch({ type: T.TOUCH_READER, payload: { lessonKey: k } }),
    // Vocabulary
    addVocabulary:         words  => dispatch({ type: T.ADD_VOCABULARY, payload: words }),
    clearVocabulary:       ()     => dispatch({ type: T.CLEAR_VOCABULARY }),
    updateVocabSRS:        (word, srsData) => dispatch({ type: T.UPDATE_VOCAB_SRS, payload: { word, ...srsData } }),
    addExportedWords:      words  => dispatch({ type: T.ADD_EXPORTED_WORDS, payload: words }),
    clearExportedWords:    ()     => dispatch({ type: T.CLEAR_EXPORTED_WORDS }),
    // Grammar
    addGrammar:            notes  => dispatch({ type: T.ADD_GRAMMAR, payload: notes }),
    clearGrammar:          ()     => dispatch({ type: T.CLEAR_GRAMMAR }),
    updateGrammarSRS:      (key, srsData) => dispatch({ type: T.UPDATE_GRAMMAR_SRS, payload: { key, ...srsData } }),
    // UI
    setLoading:            (loading, message) => dispatch({ type: T.SET_LOADING, payload: { loading, message } }),
    setError:              msg    => dispatch({ type: T.SET_ERROR, payload: msg }),
    clearError:            ()     => dispatch({ type: T.CLEAR_ERROR }),
    notify:                (type, message, action) => dispatch({ type: T.SET_NOTIFICATION, payload: { type, message, ...(action ? { action } : {}) } }),
    clearAll:              ()     => dispatch({ type: T.CLEAR_ALL_DATA }),
    setMaxTokens:          n      => dispatch({ type: T.SET_MAX_TOKENS, payload: Number(n) }),
    setDefaultLevel:       n      => dispatch({ type: T.SET_DEFAULT_LEVEL, payload: Number(n) }),
    setDefaultTopikLevel:  n      => dispatch({ type: T.SET_DEFAULT_TOPIK_LEVEL, payload: Number(n) }),
    setDefaultYueLevel:    n      => dispatch({ type: T.SET_DEFAULT_YUE_LEVEL, payload: Number(n) }),
    setDarkMode:           val    => dispatch({ type: T.SET_DARK_MODE, payload: Boolean(val) }),
    setTtsVoice:           uri    => dispatch({ type: T.SET_TTS_VOICE, payload: uri }),
    setTtsKoVoice:         uri    => dispatch({ type: T.SET_TTS_KO_VOICE, payload: uri }),
    setTtsYueVoice:        uri    => dispatch({ type: T.SET_TTS_YUE_VOICE, payload: uri }),
    setTtsVoiceForLang:    (langId, uri) => dispatch({ type: T.SET_TTS_VOICE_FOR_LANG, payload: { langId, uri } }),
    setExportSentenceRom:  (langId, val) => dispatch({ type: T.SET_EXPORT_SENTENCE_ROM, payload: { langId, value: Boolean(val) } }),
    setExportSentenceTrans:(langId, val) => dispatch({ type: T.SET_EXPORT_SENTENCE_TRANS, payload: { langId, value: Boolean(val) } }),
    setTtsSpeechRate:      rate   => dispatch({ type: T.SET_TTS_SPEECH_RATE, payload: Number(rate) }),
    setRomanizationOn:     val    => dispatch({ type: T.SET_ROMANIZATION_ON, payload: Boolean(val) }),
    setTranslateButtons:   val    => dispatch({ type: T.SET_TRANSLATE_BUTTONS, payload: Boolean(val) }),
    setTranslateQuestions: val    => dispatch({ type: T.SET_TRANSLATE_QUESTIONS, payload: Boolean(val) }),
    setStructuredOutput:   val    => dispatch({ type: T.SET_STRUCTURED_OUTPUT, payload: Boolean(val) }),
    setNewCardsPerDay:     n      => dispatch({ type: T.SET_NEW_CARDS_PER_DAY, payload: Number(n) }),
    setDefaultLevelForLang:(langId, level) => dispatch({ type: T.SET_DEFAULT_LEVEL_FOR_LANG, payload: { langId, level: Number(level) } }),
    setNativeLang:         langId => dispatch({ type: T.SET_NATIVE_LANG, payload: langId }),
    setShowArchived:       val    => dispatch({ type: T.SET_SHOW_ARCHIVED, payload: Boolean(val) }),
    // Background generation tracking
    startPendingReader:    key    => dispatch({ type: T.START_PENDING_READER, payload: key }),
    clearPendingReader:    key    => dispatch({ type: T.CLEAR_PENDING_READER, payload: key }),
    // Backup / restore (prefer context.performRestore for side-effect-safe restore)
    restoreFromBackup:     data   => dispatch({ type: T.RESTORE_FROM_BACKUP, payload: data }),
    revertMerge:           snapshot => dispatch({ type: T.REVERT_MERGE, payload: snapshot }),
    // Cloud sync
    setCloudUser:          user   => dispatch({ type: T.SET_CLOUD_USER, payload: user }),
    setCloudSyncing:       val    => dispatch({ type: T.SET_CLOUD_SYNCING, payload: val }),
    setCloudLastSynced:    ts     => dispatch({ type: T.SET_CLOUD_LAST_SYNCED, payload: ts }),
    mergeWithCloud:        data   => dispatch({ type: T.MERGE_WITH_CLOUD, payload: data }),
    clearMergeSnapshot:    ()     => dispatch({ type: T.CLEAR_MERGE_SNAPSHOT }),
    // Fetched models
    setFetchedModels:      (provider, models) => dispatch({ type: T.SET_FETCHED_MODELS, payload: { provider, models } }),
    // Learning activity
    logActivity:           (type, extra) => dispatch({ type: T.LOG_ACTIVITY, payload: { type, ...extra } }),
    // Reading time
    updateReadingTime:     (lessonKey, seconds) => dispatch({ type: T.UPDATE_READING_TIME, payload: { lessonKey, seconds } }),
    logReadingSession:     (lessonKey, seconds) => dispatch({ type: T.LOG_READING_SESSION, payload: { lessonKey, seconds } }),
    // Weekly goals
    setWeeklyGoals:        goals => dispatch({ type: T.SET_WEEKLY_GOALS, payload: goals }),
  };
}
