import { useState, useEffect } from 'react';
import { useAppSelector } from '../context/useAppSelector';
import { useT } from '../i18n';
import { Loader } from 'lucide-react';
import './BackgroundGenerationBar.css';

/**
 * Global floating bar that shows when readers are generating in the background.
 * Visible from any page so users know generation is running even after navigation.
 * Shows elapsed time and progress estimation.
 */
export default function BackgroundGenerationBar({ activeLessonKey, onNavigateToReader }) {
  const pendingReaders = useAppSelector(s => s.pendingReaders);
  const t = useT();
  const [elapsed, setElapsed] = useState(0);

  const entries = Object.entries(pendingReaders);
  const count = entries.length;

  // Find the earliest startedAt for elapsed time display
  const earliestStart = entries.reduce((min, [, meta]) => {
    const st = meta?.startedAt || 0;
    return st < min && st > 0 ? st : min;
  }, Infinity);

  // Tick elapsed time every second
  useEffect(() => {
    if (count === 0) return;
    setElapsed(Math.floor((Date.now() - earliestStart) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - earliestStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [count, earliestStart]);

  if (count === 0) return null;

  // Don't show if the user is currently viewing the generating reader
  // and there's only one generation running — the inline progress is enough
  if (count === 1 && entries[0][0] === activeLessonKey) return null;

  // Estimate progress: typical generation takes ~25s
  const estimatedTotal = 25;
  const pct = Math.min(95, Math.round((elapsed / estimatedTotal) * 100));

  // Build the first pending reader's topic for display
  const firstEntry = entries[0];
  const topicLabel = firstEntry[1]?.topic
    ? firstEntry[1].topic.split('—')[0].trim().slice(0, 30)
    : '';

  const label = count > 1
    ? t('bgGen.generatingCount', { count })
    : t('bgGen.generating');

  function handleClick() {
    if (count === 1 && onNavigateToReader) {
      onNavigateToReader(firstEntry[0]);
    }
  }

  return (
    <div
      className="bg-gen-bar"
      onClick={handleClick}
      role={count === 1 ? 'button' : 'status'}
      tabIndex={count === 1 ? 0 : undefined}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleClick()}
    >
      <div className="bg-gen-bar__progress" style={{ width: `${pct}%` }} />
      <div className="bg-gen-bar__content">
        <Loader size={14} className="bg-gen-bar__spinner" />
        <span className="bg-gen-bar__label">
          {label}
          {topicLabel && count === 1 && (
            <span className="bg-gen-bar__topic"> {topicLabel}</span>
          )}
        </span>
        <span className="bg-gen-bar__time">
          {t('bgGen.elapsed', { seconds: elapsed })}
        </span>
      </div>
    </div>
  );
}
