import '@/i18n';

import { Stack } from 'expo-router';
import {
  Catamaran_400Regular,
  Catamaran_500Medium,
  Catamaran_600SemiBold,
  Catamaran_700Bold,
  Catamaran_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/catamaran';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { AuthProvider } from '@/auth/AuthContext';
import { headerOptions } from '@/ui/header';
import { Loading } from '@/ui/components';

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({
    Catamaran_400Regular,
    Catamaran_500Medium,
    Catamaran_600SemiBold,
    Catamaran_700Bold,
    Catamaran_800ExtraBold,
  });
  if (!fontsLoaded) return <Loading />;
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" options={{ title: t('company') }} />
        <Stack.Screen name="receipt/[id]" options={{ title: t('payments.receipt') }} />
        <Stack.Screen name="owner" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
