import iconUrl from "../assets/app-icon.png";

interface Props {
  onDismiss: () => void;
}

export function OnboardingView({ onDismiss }: Props) {
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding">
        <img className="onboarding__icon" src={iconUrl} alt="IRS Snap" />
        <h1 className="onboarding__title">IRS Snap</h1>
        <p className="onboarding__tagline">
          IRC · Treasury Regs · Forms · Pubs — offline
        </p>

        <div className="onboarding__features">
          <FeatureRow
            icon="⌕"
            text="Search IRC §, 26 CFR, IRS Forms, and Pubs in 2 seconds"
          />
          <FeatureRow
            icon="↔"
            text="Form ↔ IRC ↔ Pub cross-link chips — tap to jump"
          />
          <FeatureRow
            icon="✎"
            text="One-tap Bluebook citation copy · notes · CSV/PDF export"
          />
          <FeatureRow
            icon="✓"
            text="No ads, no subscription. Works offline."
          />
        </div>

        <p className="onboarding__footer">
          Built for CPAs, EAs, tax attorneys, and self-employed filers.
        </p>

        <button className="onboarding__cta" onClick={onDismiss}>
          Get Started
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="onboarding__feature">
      <span className="onboarding__feature-icon">{icon}</span>
      <span className="onboarding__feature-text">{text}</span>
    </div>
  );
}
