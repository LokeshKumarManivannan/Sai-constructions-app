import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { headerOptions } from '@/ui/header';

export default function CustomerLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="customer">
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pay" options={{ title: t('payments.logCustomer') }} />
      </Stack>
    </RoleGate>
  );
}
