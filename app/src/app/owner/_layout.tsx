import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { HeaderActions } from '@/ui/HeaderActions';
import { colors } from '@/ui/theme';

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="owner">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderActions />,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="customers/new" options={{ title: t('owner.newCustomer') }} />
        <Stack.Screen name="customers/[id]" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="projects/new" options={{ title: t('owner.newProject') }} />
        <Stack.Screen name="projects/[id]" options={{ title: t('owner.projects') }} />
        <Stack.Screen name="payment" options={{ title: t('payments.log') }} />
        <Stack.Screen name="supervisors" options={{ title: t('owner.supervisors') }} />
      </Stack>
    </RoleGate>
  );
}
