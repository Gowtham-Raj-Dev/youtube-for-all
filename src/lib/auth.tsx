import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

type AuthState = { user: User | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** The signed-in user. Only call inside routes guarded by RequireAuth. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useUser called without a signed-in user");
  return user;
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export async function signOut() {
  sessionStorage.clear();
  // Drop out of the chat's "online" list right away instead of after the timeout.
  if (auth.currentUser) await deleteDoc(doc(db, "presence", auth.currentUser.uid)).catch(() => {});
  await fbSignOut(auth);
}
