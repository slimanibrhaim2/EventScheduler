import { useAuth } from "./auth";

function GamepadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="8" y="20" width="48" height="26" rx="12" stroke="currentColor" strokeWidth="2.2" />
      <path d="M22 27.5v11M16.5 33h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42" cy="29" r="2.4" fill="currentColor" />
      <circle cx="47.5" cy="33.5" r="2.4" fill="currentColor" />
      <circle cx="42" cy="38" r="2.4" fill="currentColor" />
      <circle cx="36.5" cy="33.5" r="2.4" fill="currentColor" />
    </svg>
  );
}

function BrandMark({ pulse }) {
  return (
    <span className={`brand-mark${pulse ? " auth-mark-pulse" : ""}`} aria-hidden="true">
      <GamepadIcon className="brand-mark-icon" />
    </span>
  );
}

function AuthShell({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-orb auth-orb-a" aria-hidden="true" />
      <div className="auth-orb auth-orb-b" aria-hidden="true" />
      <div className="auth-orb auth-orb-c" aria-hidden="true" />
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-card auth-card-enter">{children}</div>
    </div>
  );
}

export function LoginScreen() {
  const { signInWithGoogle, error, firebaseConfigured, missingKeys, loading } = useAuth();

  return (
    <AuthShell>
      <div className="brand auth-brand">
        <BrandMark pulse />
        <div>
          <strong>Event Scheduler</strong>
          <div className="sub">Game event control room</div>
        </div>
      </div>

      <div className="auth-hero-copy">
        <h1>
          Schedule <span>game events</span> with precision
        </h1>
        <p className="sub">Sign in with Google. New accounts wait for admin approval.</p>
      </div>

      {!firebaseConfigured ? (
        <div className="auth-box">
          <p className="error">Firebase is not configured in the client.</p>
          <p className="sub">Add these to `client/.env` then restart Vite:</p>
          <pre className="fleet-example">
            {`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...`}
          </pre>
          {missingKeys.length > 0 && <p className="sub">Missing: {missingKeys.join(", ")}</p>}
        </div>
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          <button
            type="button"
            className="btn primary auth-google"
            disabled={loading}
            onClick={() => signInWithGoogle()}
          >
            <span className="auth-google-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 11.9S6.8 21.3 12 21.3c6.4 0 7.9-4.5 7.9-6.8 0-.5 0-.8-.1-1.1H12z"
                />
              </svg>
            </span>
            Continue with Google
          </button>

          <div className="auth-steps">
            <div className="auth-step">
              <span>1</span>
              Google sign-in
            </div>
            <div className="auth-step">
              <span>2</span>
              Admin approval
            </div>
            <div className="auth-step">
              <span>3</span>
              Run schedules
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export function PendingScreen() {
  const { appUser, logout, refreshAppUser, isRejected } = useAuth();

  return (
    <AuthShell>
      <div className="brand auth-brand">
        <BrandMark />
        <div>
          <strong>Event Scheduler</strong>
          <div className="sub">{isRejected ? "Access blocked" : "Almost there"}</div>
        </div>
      </div>

      <h1>{isRejected ? "Access rejected" : "Waiting for approval"}</h1>

      <div className="auth-account-pill">
        <span className="auth-account-dot" aria-hidden="true" />
        <div>
          <div className="sub">Signed in as</div>
          <strong>{appUser?.email}</strong>
        </div>
      </div>

      <p className="sub">
        {isRejected
          ? "An admin rejected this account. Contact your admin if this is a mistake."
          : "Your account is pending. An admin must approve you before you can open the scheduler."}
      </p>

      {!isRejected && (
        <div className="auth-waiting" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <div className="actions auth-actions">
        {!isRejected && (
          <button type="button" className="btn" onClick={() => refreshAppUser().catch(() => {})}>
            Check again
          </button>
        )}
        <button type="button" className="btn btn-danger" onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}

export function AuthLoadingScreen() {
  return (
    <AuthShell>
      <div className="auth-loading">
        <div className="auth-spinner" aria-hidden="true" />
        <p className="sub">Checking sign-in…</p>
      </div>
    </AuthShell>
  );
}
