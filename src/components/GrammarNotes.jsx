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
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <div className={`grammar-card ${open ? 'grammar-card--open' : ''}`}>
      <button
        className="grammar-card__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="grammar-card__num text-subtle">{index + 1}</span>
        <span className="grammar-card__pattern text-chinese">
          {renderChars ? renderChars(note.pattern, `gp-${index}`) : note.pattern}
        </span>
        {note.label && (
          <span className="grammar-card__label text-muted">{note.label}</span>
        )}
        <span className="grammar-card__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="grammar-card__body fade-in">
          <div className="grammar-card__section">
            <TranslatableText
              text={note.explanation}
              langId={langId}
              nativeLang={nativeLang}
              enabled={generatedInTargetLang}
              tag="p"
              className="grammar-card__explanation"
            >
              {onWordClick
                ? <InteractiveText text={note.explanation} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`gex-${index}`} onWordClick={onWordClick} />
                : note.explanation}
            </TranslatableText>
          </div>
          {note.example && (
            <div className="grammar-card__section">
              <span className="grammar-card__example-label text-subtle">{t('grammar.exampleLabel')}</span>
              <p className="grammar-card__example text-chinese">
                {(() => {
                  const cleaned = note.example.replace(/^[-•]\s*/, '');
                  if (onWordClick) return <InteractiveText text={cleaned} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`ge-${index}`} onWordClick={onWordClick} />;
                  return renderChars ? renderChars(cleaned, `ge-${index}`) : cleaned;
                })()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
