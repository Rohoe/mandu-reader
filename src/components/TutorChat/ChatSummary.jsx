/**
 * Collapsible lesson summary card — used both inside the chat drawer
 * and as a section in ReaderView.
 */

import { useState } from 'react';
import { useT } from '../../i18n';

export default function ChatSummary({ summary, collapsible = false }) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(collapsible);

  if (!summary) return null;

  return (
    <div className="tutor-chat__summary-card">
      <button
        className="tutor-chat__summary-header"
        onClick={() => collapsible && setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        disabled={!collapsible}
      >
        <span className="tutor-chat__summary-title">{t('tutor.summary')}</span>
        {collapsible && <span className="tutor-chat__summary-toggle">{collapsed ? '▸' : '▾'}</span>}
      </button>
      {!collapsed && (
        <div className="tutor-chat__summary-body">
          {summary}
        </div>
      )}
    </div>
  );
}
