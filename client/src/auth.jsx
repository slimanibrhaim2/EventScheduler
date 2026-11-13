import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, firebaseConfigured, firebaseMissingKeys, googleProvider } from "./firebase";
import { api, setAuthToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setError("");
      if (!user) {
        setAuthToken(null);
        setAppUser(null);
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        setAuthToken(token);
        const me = await api.me();
        setAppUser(me.user);
        setError("");
      } catch (err) {
        if (err.code === "PENDING_APPROVAL" && err.user) {
          setAppUser(err.user);
          setError("");
        } else {
          setError(err.message || "Could not load your account");
          setAppUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      firebaseConfigured,
      missingKeys: firebaseMissingKeys(),
      firebaseUser,
      appUser,
      loading,
      error,
      isApproved: appUser?.status === "approved",
      isOwner: appUser?.role === "owner" && appUser?.status === "approved",
      isAdmin:
        (appUser?.role === "owner" || appUser?.role === "admin") &&
        appUser?.status === "approved",
      isPending: appUser?.status === "pending",
      isRejected: appUser?.status === "rejected",
      async signInWithGoogle() {
        if (!auth) throw new Error("Firebase is not configured");
        setError("");
        setLoading(true);
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (err) {
          setError(err.message);
          setLoading(false);
          throw err;
        }
      },
      async refreshAppUser() {
        if (!auth?.currentUser) return null;
        const token = await auth.currentUser.getIdToken(true);
        setAuthToken(token);
        const me = await api.me();
        setAppUser(me.user);
        return me.user;
      },
      async logout() {
        setAuthToken(null);
        setAppUser(null);
        if (auth) await signOut(auth);
      },
    }),
    [firebaseUser, appUser, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
