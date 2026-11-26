import '@/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { AuthProvider } from '@/auth/AuthContext';
import { HeaderActions } from '@/ui/HeaderActions';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderActions />,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t('company') }} />
        <Stack.Screen name="invite/[token]" options={{ title: t('company') }} />
        <Stack.Screen name="owner" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
