import { useState } from 'react';
import { renderInline, stripMarkdown } from '../lib/renderInline';
import { useT } from '../i18n';
import TranslatableText from './TranslatableText';
import { InteractiveText } from './WordSegments';
import { Volume2, Square } from 'lucide-react';
import './VocabularyList.css';

function VocabCard({ word, index, renderChars, speakText, speakingKey, ttsSupported, showParagraphTools, onTranslateExample, translatingKey, vocabTranslations, visibleTranslations, toggleTranslation, langId, nativeLang, generatedInTargetLang, onWordClick, romanizer }) {
  const [open, setOpen] = useState(false);
  const t = useT();

  const spacedRomanization = (() => {
    if (!romanizer) return word.romanization || word.pinyin;
    try { return romanizer.romanize(word.target || word.chinese).join(' ').replace(/ +/g, ' ').trim(); }
    catch { return word.romanization || word.pinyin; }
  })();

  function handleTts(e, text, key) {
    e.stopPropagation();
    speakText(stripMarkdown(text), key);
  }

  function handleTranslate(e, type, text) {
    e.stopPropagation();
    const key = `${type}-${index}`;
    const cached = vocabTranslations[key] || (type === 'story' ? word.exampleStoryTranslation : word.exampleExtraTranslation);
    if (cached) {
      toggleTranslation(key);
    } else {
      toggleTranslation(key, true);
      onTranslateExample(index, type, text);
    }
  }

  return (
    <div className={`vocab-card ${open ? 'vocab-card--open' : ''}`}>
      <button
        className="vocab-card__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="vocab-card__num text-subtle">{index + 1}</span>
        <span className="vocab-card__chinese text-chinese">
          {renderChars ? renderChars(word.target || word.chinese, `vc-${index}`) : (word.target || word.chinese)}
        </span>
        <span className="vocab-card__pinyin text-muted">{spacedRomanization}</span>
        <span className="vocab-card__english">{word.translation || word.english}</span>
        <span className="vocab-card__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="vocab-card__body fade-in">
          {word.exampleStory && (
            <div className="vocab-card__example">
              <span className="vocab-card__example-label text-subtle">{t('vocab.fromStory')}</span>
              <p className="vocab-card__example-text text-chinese">
                {onWordClick
                  ? <InteractiveText text={word.exampleStory} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`ves-${index}`} onWordClick={onWordClick} />
                  : (renderChars?.(word.exampleStory, `ves-${index}`) || renderInline(word.exampleStory))}
                {showParagraphTools && (
                  <>
                    {ttsSupported && (
                      <button
                        className={`reader-view__para-tts-btn ${speakingKey === `vocab-story-${index}` ? 'reader-view__para-tts-btn--active' : ''}`}
                        onClick={(e) => handleTts(e, word.exampleStory, `vocab-story-${index}`)}
                        title={t('story.listen')}
                        aria-label={t('vocab.listenToExample')}
                      >
                        {speakingKey === `vocab-story-${index}` ? <Square size={12} /> : <Volume2 size={14} />}
                      </button>
                    )}
                    <button
                      className={`reader-view__translate-btn ${translatingKey === `story-${index}` ? 'reader-view__translate-btn--loading' : ''} ${visibleTranslations.has(`story-${index}`) ? 'reader-view__translate-btn--active' : ''}`}
                      onClick={(e) => handleTranslate(e, 'story', word.exampleStory)}
                      disabled={translatingKey === `story-${index}`}
                      title={visibleTranslations.has(`story-${index}`) ? t('vocab.hideTranslation') : t('vocab.translateToEnglish')}
                      aria-label={visibleTranslations.has(`story-${index}`) ? t('vocab.hideTranslation') : t('vocab.translateToEnglish')}
                    >
                      EN
                    </button>
                  </>
                )}
              </p>
              {visibleTranslations.has(`story-${index}`) && (vocabTranslations[`story-${index}`] || word.exampleStoryTranslation) && (
                <p className="vocab-card__example-translation text-muted">{vocabTranslations[`story-${index}`] || word.exampleStoryTranslation}</p>
              )}
              {word.usageNoteStory && (
                generatedInTargetLang
                  ? <TranslatableText text={word.usageNoteStory} langId={langId} nativeLang={nativeLang} enabled tag="p" className="vocab-card__usage-note text-subtle" />
                  : <p className="vocab-card__usage-note text-subtle">{renderInline(word.usageNoteStory)}</p>
              )}
            </div>
          )}
          {word.exampleExtra && (
            <div className="vocab-card__example">
              <span className="vocab-card__example-label text-subtle">{t('vocab.additionalExample')}</span>
              <p className="vocab-card__example-text text-chinese">
                {onWordClick
                  ? <InteractiveText text={word.exampleExtra} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`vee-${index}`} onWordClick={onWordClick} />
                  : (renderChars?.(word.exampleExtra, `vee-${index}`) || renderInline(word.exampleExtra))}
                {showParagraphTools && (
                  <>
                    {ttsSupported && (
                      <button
                        className={`reader-view__para-tts-btn ${speakingKey === `vocab-extra-${index}` ? 'reader-view__para-tts-btn--active' : ''}`}
                        onClick={(e) => handleTts(e, word.exampleExtra, `vocab-extra-${index}`)}
                        title={t('story.listen')}
                        aria-label={t('vocab.listenToExample')}
                      >
                        {speakingKey === `vocab-extra-${index}` ? <Square size={12} /> : <Volume2 size={14} />}
                      </button>
                    )}
                    <button
                      className={`reader-view__translate-btn ${translatingKey === `extra-${index}` ? 'reader-view__translate-btn--loading' : ''} ${visibleTranslations.has(`extra-${index}`) ? 'reader-view__translate-btn--active' : ''}`}
                      onClick={(e) => handleTranslate(e, 'extra', word.exampleExtra)}
                      disabled={translatingKey === `extra-${index}`}
                      title={visibleTranslations.has(`extra-${index}`) ? t('vocab.hideTranslation') : t('vocab.translateToEnglish')}
                      aria-label={visibleTranslations.has(`extra-${index}`) ? t('vocab.hideTranslation') : t('vocab.translateToEnglish')}
                    >
                      EN
                    </button>
                  </>
                )}
              </p>
              {visibleTranslations.has(`extra-${index}`) && (vocabTranslations[`extra-${index}`] || word.exampleExtraTranslation) && (
                <p className="vocab-card__example-translation text-muted">{vocabTranslations[`extra-${index}`] || word.exampleExtraTranslation}</p>
              )}
              {word.usageNoteExtra && (
                generatedInTargetLang
                  ? <TranslatableText text={word.usageNoteExtra} langId={langId} nativeLang={nativeLang} enabled tag="p" className="vocab-card__usage-note text-subtle" />
                  : <p className="vocab-card__usage-note text-subtle">{renderInline(word.usageNoteExtra)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VocabularyList({ vocabulary, renderChars, speakText, speakingKey, ttsSupported, showParagraphTools, onTranslateExample, translatingKey, vocabTranslations, langId, nativeLang, generatedInTargetLang, onWordClick, romanizer }) {
  const [collapsed, setCollapsed] = useState(false);
  const [visibleTranslations, setVisibleTranslations] = useState(new Set());
  const t = useT();

  function toggleTranslation(key, forceShow) {
    setVisibleTranslations(prev => {
      const next = new Set(prev);
      if (forceShow || !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  if (!vocabulary || vocabulary.length === 0) return null;

  return (
    <section className="vocabulary-list">
      <button
        className="vocabulary-list__toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="vocabulary-list-content"
      >
        <h2 className="vocabulary-list__title font-display">
          {t('vocab.title')} <span className="vocabulary-list__count">({vocabulary.length})</span>
        </h2>
        <span className="vocabulary-list__toggle-icon">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div id="vocabulary-list-content" className="vocabulary-list__cards fade-in">
          {vocabulary.map((word, i) => (
            <VocabCard
              key={(word.target || word.chinese) + i}
              word={word}
              index={i}
              renderChars={renderChars}
              speakText={speakText}
              speakingKey={speakingKey}
              ttsSupported={ttsSupported}
              showParagraphTools={showParagraphTools}
              onTranslateExample={onTranslateExample}
              translatingKey={translatingKey}
              vocabTranslations={vocabTranslations || {}}
              visibleTranslations={visibleTranslations}
              toggleTranslation={toggleTranslation}
              langId={langId}
              nativeLang={nativeLang}
              generatedInTargetLang={generatedInTargetLang}
              onWordClick={onWordClick}
              romanizer={romanizer}
            />
          ))}
        </div>
      )}
    </section>
  );
}
