import { getLang } from '../../lib/languages';

const STATUS_ICONS = {
  pending: '○',
  generated: '◐',
  in_progress: '◐',
  completed: '●',
};

export default function PathGroup({
  path, isActive, isExpanded, onPathClick, onToggleExpand, onUnitClick,
}) {
  const langConfig = getLang(path.langId);
  const completedCount = path.units.filter(u => u.status === 'completed').length;
  const generatedCount = path.units.filter(u => u.syllabusId).length;

  return (
    <div className={`path-group ${isActive ? 'path-group--active' : ''}`}>
      <button
        className="path-group__header"
        onClick={() => onPathClick(path.id)}
        aria-expanded={isExpanded}
      >
        <span className="path-group__icon">📚</span>
        <span className="path-group__title">{path.title}</span>
        <span className="path-group__badge">
          {completedCount}/{path.units.length}
        </span>
        <button
          className="path-group__expand btn-unstyled"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(path.id); }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
      </button>

      {isExpanded && (
        <div className="path-group__units">
          {path.units.map((unit, i) => (
            <button
              key={i}
              className={`path-group__unit ${unit.syllabusId ? 'path-group__unit--generated' : ''}`}
              onClick={() => unit.syllabusId ? onUnitClick(unit.syllabusId) : onPathClick(path.id)}
              disabled={!unit.syllabusId}
            >
              <span className="path-group__unit-status">{STATUS_ICONS[unit.status] || '○'}</span>
              <span className="path-group__unit-title">{unit.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
