export default function StepBlueprint({ generating }) {
  if (!generating) return null;

  return (
    <div className="path-wizard__step path-wizard__generating">
      <div className="path-wizard__spinner" />
      <h3 className="path-wizard__step-title font-display">Designing your learning path...</h3>
      <p className="path-wizard__step-subtitle">
        The AI is analyzing your interests and creating a structured curriculum.
        This usually takes 10-20 seconds.
      </p>
    </div>
  );
}
