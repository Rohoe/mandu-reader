import { useState } from 'react';
import { useT } from '../i18n';

export default function ReaderActions({ isDemo, isCompleted, onMarkComplete, onUnmarkComplete, lessonKey, confirmRegen, setConfirmRegen, handleRegenConfirm, onContinueStory, reader, lessonMeta, isPending, langId, onArchive, onDelete, onDifficultyFeedback, hasFeedback, nextActions }) {
  const t = useT();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isStandalone = lessonKey?.startsWith('standalone_');

  return (
    <>
      {/* Mark complete */}
      {!isDemo && !isCompleted && onMarkComplete && (
        <div className="reader-view__complete-row">
          <button className="btn btn-primary reader-view__complete-btn" onClick={onMarkComplete}>{isStandalone ? t('reader.actions.markComplete') : t('reader.actions.markLessonComplete')}</button>
        </div>
      )}
      {isCompleted && (
        <div className="reader-view__completed-badge">
          <span>{isStandalone ? `\u2713 ${t('reader.actions.completed')}` : `\u2713 ${t('reader.actions.lessonCompleted')}`}</span>
          {onUnmarkComplete && (
            <button className="btn btn-ghost btn-sm reader-view__unmark-btn" onClick={onUnmarkComplete}>{t('common.undo')}</button>
          )}
        </div>
      )}

      {/* Difficulty feedback */}
      {isCompleted && onDifficultyFeedback && !hasFeedback && (
        <div className="reader-view__feedback-row">
          <span className="reader-view__feedback-label text-muted">{t('reader.feedback.howWas')}</span>
          <div className="reader-view__feedback-pills">
            <button className="reader-view__feedback-pill" onClick={() => onDifficultyFeedback('too_easy')}>{t('reader.feedback.tooEasy')}</button>
            <button className="reader-view__feedback-pill reader-view__feedback-pill--active" onClick={() => onDifficultyFeedback('just_right')}>{t('reader.feedback.justRight')}</button>
            <button className="reader-view__feedback-pill" onClick={() => onDifficultyFeedback('too_difficult')}>{t('reader.feedback.tooDifficult')}</button>
          </div>
        </div>
      )}
      {isCompleted && hasFeedback && (
        <p className="reader-view__feedback-thanks text-muted">{t('reader.feedback.thanks')}</p>
      )}

      {/* Next action suggestions (post-lesson) */}
      {isCompleted && nextActions}

      {/* Regenerate */}
      {!isDemo && (
        <div className="reader-view__regen-row">
          {confirmRegen ? (
            <>
              <span className="reader-view__regen-prompt text-muted">{t('reader.actions.replaceReader')}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRegen(false)}>{t('common.cancel')}</button>
              <button className="btn btn-sm reader-view__regen-confirm-btn" onClick={handleRegenConfirm}>{t('reader.actions.regenerate')}</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRegen(true)}>{t('reader.actions.regenerateReader')}</button>
          )}
        </div>
      )}

      {/* Continue story */}
      {!isDemo && onContinueStory && reader.story && !isPending && (
        <div className="reader-view__continue-row">
          <button
            className="btn btn-primary"
            onClick={() => onContinueStory({ story: reader.story, topic: reader.topic || lessonMeta?.title_en || 'story', level: reader.level ?? lessonMeta?.level ?? 3, langId })}
          >
            {t('reader.actions.nextEpisode')}
          </button>
        </div>
      )}

      {/* Danger zone — standalone readers only */}
      {!isDemo && isStandalone && (onArchive || onDelete) && (
        <section className="syllabus-home__danger-zone">
          <div className="syllabus-home__danger-divider">
            <span className="text-subtle">{t('reader.actions.dangerZone')}</span>
          </div>

          {confirmingDelete ? (
            <div className="syllabus-home__confirm">
              <p className="syllabus-home__confirm-text">
                {t('reader.actions.confirmDelete')}
              </p>
              <div className="syllabus-home__confirm-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-sm syllabus-home__delete-confirm-btn"
                  onClick={() => { setConfirmingDelete(false); onDelete?.(); }}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div className="syllabus-home__danger-actions">
              {onArchive && (
                <button
                  className="btn btn-ghost syllabus-home__archive-btn"
                  onClick={onArchive}
                >
                  {t('reader.actions.archiveReader')}
                </button>
              )}
              {onDelete && (
                <button
                  className="btn syllabus-home__delete-btn"
                  onClick={() => setConfirmingDelete(true)}
                >
                  {t('reader.actions.deleteReader')}
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
