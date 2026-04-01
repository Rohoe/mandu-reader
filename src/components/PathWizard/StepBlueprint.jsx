import { useT } from '../../i18n';

export default function StepBlueprint({ generating }) {
  const t = useT();
  if (!generating) return null;

  return (
    <div className="path-wizard__step path-wizard__generating">
      <div className="path-wizard__spinner" />
      <h3 className="path-wizard__step-title font-display">{t('pathWizard.generating')}</h3>
      <p className="path-wizard__step-subtitle">
        {t('pathWizard.generatingDesc')}
      </p>
    </div>
  );
}
