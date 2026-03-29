import { useT } from '../../i18n';
import './AccuracyNotes.css';

const STATUS_LABELS = {
  accurate: 'accuracyNotes.accurate',
  simplified: 'accuracyNotes.simplified',
  creative_liberty: 'accuracyNotes.creativeLiberty',
};

export default function AccuracyNotes({ notes }) {
  const t = useT();
  if (!notes?.length) return null;

  return (
    <details className="accuracy-notes">
      <summary className="accuracy-notes__header">
        {t('accuracyNotes.title')} ({notes.length})
      </summary>
      <ul className="accuracy-notes__list">
        {notes.map((note, i) => (
          <li key={i} className="accuracy-notes__item">
            <span className={`accuracy-notes__badge accuracy-notes__badge--${note.status}`}>
              {t(STATUS_LABELS[note.status] || 'accuracyNotes.accurate')}
            </span>
            <span className="accuracy-notes__claim">{note.claim}</span>
            {note.note && <p className="accuracy-notes__explanation">{note.note}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
