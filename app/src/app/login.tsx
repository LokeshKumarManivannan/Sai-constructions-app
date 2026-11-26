import { useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RoleGate';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, Screen, Title } from '@/ui/components';

export default function Login() {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? '');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href={homeFor(user.role)} />;

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ dev_code: string | null }>('/auth/otp/request', { method: 'POST', body: { phone } });
      setDevCode(r.dev_code);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ access_token: string; user: User }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code },
      });
      await signIn(r.access_token, r.user);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 403 ? t('login.notRegistered') : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('login.title')}</Title>
      <Card>
        {step === 'phone' ? (
          <>
            <Field
              label={t('login.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="98765 43210"
            />
            <BigButton label={t('login.sendCode')} icon="chatbox-ellipses" onPress={sendCode} busy={busy} disabled={phone.trim().length < 10} />
          </>
        ) : (
          <>
            <Muted>
              {t('login.codeSent')} {phone}
            </Muted>
            <Field
              label={t('login.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
            />
            {devCode && <Muted>{t('login.devCode', { code: devCode })}</Muted>}
            <BigButton label={t('login.verify')} icon="log-in" onPress={verify} busy={busy} disabled={code.length !== 6} />
            <BigButton label={t('login.changeNumber')} variant="secondary" onPress={() => setStep('phone')} />
          </>
        )}
        <ErrorText>{error}</ErrorText>
      </Card>
    </Screen>
  );
}
