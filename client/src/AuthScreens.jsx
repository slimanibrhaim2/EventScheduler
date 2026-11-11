import { useAuth } from "./auth";

function AuthShell({ children, wide }) {
  return (
    <div className="auth-screen">
      <div className="auth-orb auth-orb-a" aria-hidden="true" />
      <div className="auth-orb auth-orb-b" aria-hidden="true" />
      <div className="auth-orb auth-orb-c" aria-hidden="true" />
      <div className={`auth-card auth-card-enter${wide ? " auth-card-wide" : ""}`}>{children}</div>
    </div>
  );
}

export function LoginScreen() {
  const { signInWithGoogle, error, firebaseConfigured, missingKeys, loading } = useAuth();

  return (
    <AuthShell>
      <div className="brand auth-brand">
        <span className="brand-mark auth-mark-pulse">ES</span>
        <div>
          <strong>Event Scheduler</strong>
          <div className="sub">Sign in with Google to continue</div>
        </div>
      </div>

      <div className="auth-hero-copy">
        <h1>Welcome back</h1>
        <p className="sub">Secure Google sign-in. New accounts wait for admin approval.</p>
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
              G
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
              Access app
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
        <span className="brand-mark">ES</span>
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
