/** Firebase phone login (web). Google sends the SMS code; we only send the resulting token to our server.
 *  The phone app needs a native Firebase module instead; until that is added, phones use the web link. */
import { Platform } from 'react-native';

import { api } from './api';

export type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };
export type AuthConfig = { provider: 'otp' | 'firebase'; firebase: FirebaseWebConfig | null };

export const RECAPTCHA_ID = 'recaptcha-container';

let confirmation: { confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }> } | null = null;

export function getAuthConfig() {
  return api<AuthConfig>('/auth/config');
}

/** "98765 43210" or "+91 98765 43210" -> "+919876543210" */
export function toE164(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return `+${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  return `+91${d.slice(-10)}`;
}

async function auth(cfg: FirebaseWebConfig) {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');
  const app = getApps()[0] ?? initializeApp(cfg);
  return getAuth(app);
}

export async function sendFirebaseCode(cfg: FirebaseWebConfig, phone: string, language: string): Promise<void> {
  if (Platform.OS !== 'web') throw new Error('PHONE_APP_UNSUPPORTED');
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
  const a = await auth(cfg);
  a.languageCode = language; // the SMS text from Google in Tamil or English
  const w = globalThis as unknown as { __saiRecaptcha?: InstanceType<typeof RecaptchaVerifier> };
  w.__saiRecaptcha?.clear();
  w.__saiRecaptcha = new RecaptchaVerifier(a, RECAPTCHA_ID, { size: 'invisible' });
  confirmation = await signInWithPhoneNumber(a, toE164(phone), w.__saiRecaptcha);
}

/** Check the code with Firebase, then exchange Firebase's token for our own login. */
export async function confirmFirebaseCode<T>(code: string): Promise<T> {
  if (!confirmation) throw new Error('NO_CODE_SENT');
  const cred = await confirmation.confirm(code);
  const idToken = await cred.user.getIdToken();
  return api<T>('/auth/firebase', { method: 'POST', body: { id_token: idToken } });
}

/** Firebase error codes -> our translation keys. */
export function firebaseErrorKey(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? (e as Error)?.message ?? '';
  if (code === 'PHONE_APP_UNSUPPORTED') return 'login.useWebLink';
  if (code.includes('invalid-verification-code')) return 'login.wrongCode';
  if (code.includes('code-expired') || code === 'NO_CODE_SENT') return 'login.codeExpired';
  if (code.includes('too-many-requests') || code.includes('quota-exceeded')) return 'login.tooMany';
  if (code.includes('invalid-phone-number')) return 'login.badPhone';
  if (code.includes('network-request-failed') || code.includes('internal-error')) return 'login.network';
  // Setup problems (e.g. auth/unauthorized-domain, auth/operation-not-allowed) show Firebase's own code for Lokesh.
  return null;
}
