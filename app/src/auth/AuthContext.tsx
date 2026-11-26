import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import i18n from '@/i18n';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { getToken, setToken } from '@/lib/storage';
import type { Language, User } from '@/lib/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      if (await getToken()) {
        try {
          const me = await api<User>('/me');
          setUser(me);
          await i18n.changeLanguage(me.language);
        } catch {
          await setToken(null);
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  const signIn = useCallback(async (token: string, u: User) => {
    await setToken(token);
    // Keep the language the person picked on the login screen.
    const lang = i18n.language as Language;
    if (lang !== u.language) {
      u = await api<User>('/me', { method: 'PATCH', body: { language: lang } });
    }
    setUser(u);
  }, []);

  const setLanguage = useCallback(
    async (lang: Language) => {
      await i18n.changeLanguage(lang);
      if (user) setUser(await api<User>('/me', { method: 'PATCH', body: { language: lang } }));
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut, setLanguage }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
