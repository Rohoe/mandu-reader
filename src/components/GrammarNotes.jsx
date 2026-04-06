import { useState } from 'react';
import { useT } from '../i18n';
import TranslatableText from './TranslatableText';
import { InteractiveText } from './WordSegments';
import './GrammarNotes.css';

export default function GrammarNotes({ grammarNotes, renderChars, langId, nativeLang, generatedInTargetLang, onWordClick }) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  if (!grammarNotes?.length) return null;

  return (
    <section className="grammar-notes">
      <button
        className="grammar-notes__toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="grammar-notes-content"
      >
        <h2 className="grammar-notes__title font-display">{t('grammar.title')}</h2>
        <span className="grammar-notes__icon">{collapsed ? '▼' : '▲'}</span>
      </button>
      {!collapsed && (
        <div id="grammar-notes-content" className="grammar-notes__cards fade-in">
          {grammarNotes.map((note, i) => (
            <GrammarCard key={note.pattern || i} note={note} index={i} renderChars={renderChars} langId={langId} nativeLang={nativeLang} generatedInTargetLang={generatedInTargetLang} onWordClick={onWordClick} />
          ))}
        </div>
      )}
    </section>
  );
}

function GrammarCard({ note, index, renderChars, langId, nativeLang, generatedInTargetLang, onWordClick }) {
  return (
    <div className="grammar-card">
      <div className="grammar-card__header">
        <span className="grammar-card__num">{index + 1}</span>
        <span className="grammar-card__pattern text-chinese">
          {onWordClick
            ? <InteractiveText text={note.pattern} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`gp-${index}`} onWordClick={onWordClick} />
            : (renderChars ? renderChars(note.pattern, `gp-${index}`) : note.pattern)}
        </span>
        <TranslatableText
          text={note.label}
          langId={langId}
          nativeLang={nativeLang}
          enabled={generatedInTargetLang}
          tag="span"
          className="grammar-card__label font-display text-muted"
        />
      </div>
      <div className="grammar-card__body">
        <TranslatableText
          text={note.explanation}
          langId={langId}
          nativeLang={nativeLang}
          enabled={generatedInTargetLang}
          tag="p"
          className="grammar-card__explanation"
        />
        {note.example && (
          <p className="grammar-card__example text-chinese">
            {(() => {
              const cleaned = note.example.replace(/^[-•]\s*/, '');
              if (onWordClick) return <InteractiveText text={cleaned} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`ge-${index}`} onWordClick={onWordClick} />;
              return renderChars ? renderChars(cleaned, `ge-${index}`) : cleaned;
            })()}
          </p>
        )}
      </div>
    </div>
  );
}
