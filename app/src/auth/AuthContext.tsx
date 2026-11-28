import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

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

  // True once the person taps the language button on the login screen in this session.
  const pickedOnLogin = useRef(false);

  const signIn = useCallback(async (token: string, u: User) => {
    await setToken(token);
    const lang = i18n.language as Language;
    if (pickedOnLogin.current && lang !== u.language) {
      // They chose a language on the login screen: remember it.
      u = await api<User>('/me', { method: 'PATCH', body: { language: lang } });
    } else if (lang !== u.language) {
      // Otherwise keep the language they chose before (a Tamil reader on a phone set to English stays in Tamil).
      await i18n.changeLanguage(u.language);
    }
    setUser(u);
  }, []);

  const setLanguage = useCallback(
    async (lang: Language) => {
      if (!user) pickedOnLogin.current = true;
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
