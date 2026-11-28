import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/RoleGate';
import { api, ApiError } from '@/lib/api';
import { confirmFirebaseCode, firebaseErrorKey, getAuthConfig, RECAPTCHA_ID, sendFirebaseCode, type AuthConfig } from '@/lib/firebasePhone';
import type { User } from '@/lib/types';
import { BuildingProgress } from '@/ui/BuildingProgress';
import { BigButton, BrickPattern, ErrorText, Field, Muted } from '@/ui/components';
import { Wordmark } from '@/ui/header';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { user, signIn, setLanguage } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? '');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    getAuthConfig()
      .then(setConfig)
      .catch(() => setConfig({ provider: 'otp', firebase: null }));
  }, []);

  if (user) return <Redirect href={homeFor(user.role)} />;
  const viaFirebase = config?.provider === 'firebase' && !!config.firebase;

  function showError(e: unknown) {
    const key = firebaseErrorKey(e);
    if (key) setError(t(key));
    else if (e instanceof ApiError && e.status === 403) setError(t('login.notRegistered'));
    else setError(e instanceof Error ? e.message : t('common.error'));
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      if (viaFirebase) {
        await sendFirebaseCode(config!.firebase!, phone, i18n.language);
        setDevCode(null);
      } else {
        const r = await api<{ dev_code: string | null }>('/auth/otp/request', { method: 'POST', body: { phone } });
        setDevCode(r.dev_code);
      }
      setStep('code');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = viaFirebase
        ? await confirmFirebaseCode<{ access_token: string; user: User }>(code)
        : await api<{ access_token: string; user: User }>('/auth/otp/verify', { method: 'POST', body: { phone, code } });
      await signIn(r.access_token, r.user);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ padding: space.l, paddingBottom: space.xl * 1.5, overflow: 'hidden' }}>
          <BrickPattern />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Wordmark size={18} />
            <Pressable
              onPress={() => setLanguage(i18n.language === 'ta' ? 'en' : 'ta')}
              style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }}
            >
              <Text style={{ color: colors.brandText, fontWeight: '600' }}>{t('common.language')}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.l, marginTop: space.xl }}>
            <View style={{ flex: 1, gap: space.s }}>
              <Text style={{ fontSize: font.hero + 4, fontWeight: '800', color: colors.brandText, lineHeight: 38 }}>{t('login.headline')}</Text>
              <Text style={{ fontSize: font.body, color: 'rgba(255,255,255,0.75)' }}>{t('login.sub')}</Text>
            </View>
            <BuildingProgress total={5} done={3} size="large" onDark />
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, marginTop: -space.l, padding: space.l, gap: space.m }}>
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: space.m }}>
            <Text style={{ fontSize: font.title, fontWeight: '700' }}>{t('login.title')}</Text>
            {step === 'phone' ? (
              <>
                <Field label={t('login.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" />
                <BigButton
                  label={t('login.sendCode')}
                  icon="chatbox-ellipses"
                  onPress={sendCode}
                  busy={busy}
                  disabled={!config || phone.replace(/\D/g, '').length < 10}
                />
              </>
            ) : (
              <>
                <Muted>{`${t('login.codeSent')} ${phone}`}</Muted>
                <Field
                  label={t('login.code')}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={6}
                  style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center' }}
                />
                {devCode && <Muted>{t('login.devCode', { code: devCode })}</Muted>}
                <BigButton label={t('login.verify')} icon="log-in" onPress={verify} busy={busy} disabled={code.length !== 6} />
                <BigButton label={t('login.changeNumber')} variant="secondary" onPress={() => setStep('phone')} />
              </>
            )}
            <ErrorText>{error}</ErrorText>
            {/* Firebase's invisible "are you a robot" check attaches here (web). */}
            <View nativeID={RECAPTCHA_ID} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
