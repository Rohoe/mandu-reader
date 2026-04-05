import { getLessonTitle } from '../../lib/languages';
import { getProvider } from '../../lib/providers';
import { useT } from '../../i18n';
import TranslatableText from '../TranslatableText';

export default function ReaderPregenerate({
  lessonMeta, langId, readerLength, setReaderLength,
  onGenerate, isPending, llmConfig, activeProvider,
  nativeLang, generatedInTargetLang,
}) {
  const t = useT();
  return (
    <div className="reader-view reader-view--pregenerate">
      <div className="reader-view__pregenerate card card-padded">
        {lessonMeta && (
          <>
            <p className="reader-view__lesson-num text-subtle font-display">{t('reader.lessonNum', { number: lessonMeta.lesson_number })}</p>
            <h2 className="text-target-title reader-view__lesson-title">{getLessonTitle(lessonMeta, langId)}</h2>
            <p className="reader-view__lesson-en font-display text-muted">{lessonMeta.title_en}</p>
            {(lessonMeta.chapter_summary || lessonMeta.description) && (
              <TranslatableText
                text={lessonMeta.chapter_summary || lessonMeta.description}
                langId={langId}
                nativeLang={nativeLang}
                enabled={!!generatedInTargetLang}
                className="reader-view__lesson-desc"
              />
            )}
            {lessonMeta.vocabulary_focus && (
              <p className="reader-view__vocab-focus text-subtle">
                {t('reader.pregen.focus')} {Array.isArray(lessonMeta.vocabulary_focus)
                  ? lessonMeta.vocabulary_focus.join(' · ')
                  : lessonMeta.vocabulary_focus}
              </p>
            )}
          </>
        )}
        <div className="reader-view__length-row">
          <label className="reader-view__length-label" htmlFor="rv-reader-length">{t('reader.pregen.readerLength')}</label>
          <span className="reader-view__length-value">{t('reader.pregen.chars', { count: readerLength })}</span>
          <input
            id="rv-reader-length" type="range" className="reader-view__length-slider"
            min={100} max={2000} step={50} value={readerLength}
            onChange={e => setReaderLength(Number(e.target.value))}
          />
          <div className="reader-view__length-ticks"><span>{t('reader.pregen.short')}</span><span>{t('reader.pregen.long')}</span></div>
        </div>
        <button className="btn btn-primary btn-lg reader-view__generate-btn" onClick={onGenerate} disabled={isPending}>
          {t('reader.pregen.generate')}
        </button>
        {llmConfig.apiKey && (
          <p className="text-muted" style={{ fontSize: 'var(--text-xs)', textAlign: 'center', marginTop: 'var(--space-2)', opacity: 0.5 }}>
            {t('reader.pregen.using', { model: (() => {
              const prov = getProvider(activeProvider);
              const modelLabel = prov.models.find(m => m.id === llmConfig.model)?.label || llmConfig.model;
              return modelLabel;
            })() })}
          </p>
        )}
      </div>
    </div>
  );
}
