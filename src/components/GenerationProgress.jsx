import { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../context/useAppSelector';
import { useT } from '../i18n';
import { getProvider } from '../lib/providers';
import './GenerationProgress.css';

function buildPhases(type, providerName, t) {
  const connectLabel = t('progress.connectingTo', { provider: providerName });
  if (type === 'syllabus') {
    return [
      { pct: 20, label: connectLabel,                          ms: 800  },
      { pct: 55, label: t('progress.designingLessons'),        ms: 3500 },
      { pct: 85, label: t('progress.writingDescriptions'),     ms: 3000 },
      { pct: 97, label: t('progress.almostDone'),              ms: 60000 },
    ];
  }
  return [
    { pct: 12, label: connectLabel,                            ms: 1200 },
    { pct: 38, label: t('progress.writingStory'),              ms: 7000 },
    { pct: 62, label: t('progress.buildingVocab'),             ms: 6000 },
    { pct: 78, label: t('progress.addingQuestions'),           ms: 4000 },
    { pct: 92, label: t('progress.preparingAnki'),             ms: 4000 },
    { pct: 98, label: t('progress.almostDone'),                ms: 60000 },
  ];
}

const TIPS = [
  'progress.tip1',
  'progress.tip2',
  'progress.tip3',
  'progress.tip4',
  'progress.tip5',
];

export default function GenerationProgress({ type = 'reader', targetLength, langId }) {
  const activeProvider = useAppSelector(s => s.activeProvider);
  const t = useT();
  const providerDef = getProvider(activeProvider);
  // Use short display name (e.g. "Anthropic" not "Anthropic (Claude)")
  const providerName = providerDef.name.split(' (')[0];
  const phases = buildPhases(type, providerName, t);

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [pct, setPct]           = useState(0);
  const startTimeRef = useRef(Date.now());
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [tipIdx, setTipIdx] = useState(0);

  // Kick off first phase immediately, then advance on timers
  useEffect(() => {
    let idx = 0;

    function advance() {
      if (idx >= phases.length) return;
      setPct(phases[idx].pct);
      setPhaseIdx(idx);
      const delay = phases[idx].ms;
      idx += 1;
      if (idx < phases.length) {
        setTimeout(advance, delay);
      }
    }

    // Small initial delay so the bar visibly starts from 0
    const timer = setTimeout(advance, 80);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estimated time remaining
  useEffect(() => {
    const totalEstimatedMs = phases.reduce((sum, p) => sum + p.ms, 0) - phases[phases.length - 1].ms; // exclude the "waiting" phase
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, Math.round((totalEstimatedMs - elapsed) / 1000));
      setSecondsRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [phases]);

  // Rotate tips every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIdx(i => (i + 1) % TIPS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const label = phases[phaseIdx]?.label ?? t('progress.working');

  return (
    <div className="gen-progress">
      <div
        className="gen-progress__bar-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="gen-progress__bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="gen-progress__label">{label}</p>
      {secondsRemaining !== null && secondsRemaining > 0 && (
        <p className="gen-progress__time text-muted">{t('progress.timeRemaining', { seconds: secondsRemaining })}</p>
      )}
      {targetLength && phaseIdx === 0 && (
        <p className="gen-progress__target text-muted">{t('progress.generatingStory', { count: targetLength })}</p>
      )}
      <p className="gen-progress__tip text-muted">{t(TIPS[tipIdx])}</p>
    </div>
  );
}
