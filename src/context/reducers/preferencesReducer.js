import {
  SET_MAX_TOKENS, SET_DEFAULT_LEVEL, SET_DEFAULT_TOPIK_LEVEL, SET_DEFAULT_YUE_LEVEL,
  SET_DARK_MODE, SET_TTS_VOICE, SET_TTS_KO_VOICE, SET_TTS_YUE_VOICE, SET_TTS_VOICE_FOR_LANG,
  SET_EXPORT_SENTENCE_ROM, SET_EXPORT_SENTENCE_TRANS, SET_TTS_SPEECH_RATE,
  SET_ROMANIZATION_ON, SET_TRANSLATE_BUTTONS, SET_STRUCTURED_OUTPUT, SET_NEW_CARDS_PER_DAY,
  SET_DEFAULT_LEVEL_FOR_LANG,
  SET_NATIVE_LANG,
  SET_WEEKLY_GOALS,
} from '../actionTypes';

export function preferencesReducer(state, action) {
  switch (action.type) {
    case SET_MAX_TOKENS:
      return { ...state, maxTokens: action.payload };

    case SET_DEFAULT_LEVEL:
      return { ...state, defaultLevel: action.payload };

    case SET_DEFAULT_TOPIK_LEVEL:
      return { ...state, defaultTopikLevel: action.payload };

    case SET_DEFAULT_YUE_LEVEL:
      return { ...state, defaultYueLevel: action.payload };

    case SET_DARK_MODE:
      return { ...state, darkMode: action.payload };

    case SET_TTS_VOICE:
      return { ...state, ttsVoiceURI: action.payload, ttsVoiceURIs: { ...state.ttsVoiceURIs, zh: action.payload } };

    case SET_TTS_KO_VOICE:
      return { ...state, ttsKoVoiceURI: action.payload, ttsVoiceURIs: { ...state.ttsVoiceURIs, ko: action.payload } };

    case SET_TTS_YUE_VOICE:
      return { ...state, ttsYueVoiceURI: action.payload, ttsVoiceURIs: { ...state.ttsVoiceURIs, yue: action.payload } };

    case SET_TTS_VOICE_FOR_LANG: {
      const { langId, uri } = action.payload;
      return {
        ...state,
        ttsVoiceURIs: { ...state.ttsVoiceURIs, [langId]: uri },
        // Write-through to legacy fields for backward compat
        ...(langId === 'zh' ? { ttsVoiceURI: uri } : {}),
        ...(langId === 'ko' ? { ttsKoVoiceURI: uri } : {}),
        ...(langId === 'yue' ? { ttsYueVoiceURI: uri } : {}),
      };
    }

    case SET_EXPORT_SENTENCE_ROM:
      return { ...state, exportSentenceRom: { ...state.exportSentenceRom, [action.payload.langId]: action.payload.value } };

    case SET_EXPORT_SENTENCE_TRANS:
      return { ...state, exportSentenceTrans: { ...state.exportSentenceTrans, [action.payload.langId]: action.payload.value } };

    case SET_TTS_SPEECH_RATE:
      return { ...state, ttsSpeechRate: action.payload };

    case SET_ROMANIZATION_ON:
      return { ...state, romanizationOn: action.payload };

    case SET_TRANSLATE_BUTTONS:
      return { ...state, translateButtons: action.payload };

    case SET_STRUCTURED_OUTPUT:
      return { ...state, useStructuredOutput: action.payload };

    case SET_NEW_CARDS_PER_DAY:
      return { ...state, newCardsPerDay: action.payload };

    case SET_NATIVE_LANG:
      return { ...state, nativeLang: action.payload };

    case SET_WEEKLY_GOALS:
      return { ...state, weeklyGoals: action.payload };

    case SET_DEFAULT_LEVEL_FOR_LANG:
      return {
        ...state,
        defaultLevels: { ...state.defaultLevels, [action.payload.langId]: action.payload.level },
        // Keep legacy keys in sync for backward compatibility
        ...(action.payload.langId === 'zh' ? { defaultLevel: action.payload.level } : {}),
        ...(action.payload.langId === 'ko' ? { defaultTopikLevel: action.payload.level } : {}),
        ...(action.payload.langId === 'yue' ? { defaultYueLevel: action.payload.level } : {}),
      };

    default:
      return undefined;
  }
}
