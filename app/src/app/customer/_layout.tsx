import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { HeaderActions } from '@/ui/HeaderActions';
import { colors } from '@/ui/theme';

export default function CustomerLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="customer">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderActions />,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pay" options={{ title: t('payments.logCustomer') }} />
      </Stack>
    </RoleGate>
  );
}
