"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { getCurrentUser, type User } from "../lib/auth";
import LoginPage from "./LoginPage";

const AuthContext = createContext<User | null>(null);

export function useCurrentUser() {
  return useContext(AuthContext);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setChecked(true);
    });
  }, []);

  if (!checked) {
    return <div className="console-shell" />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
