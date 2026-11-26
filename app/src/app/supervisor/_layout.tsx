import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { HeaderActions } from '@/ui/HeaderActions';
import { colors } from '@/ui/theme';

export default function SupervisorLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="supervisor">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderActions />,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: t('supervisor.mySites') }} />
        <Stack.Screen name="site/[id]" options={{ title: t('progress.title') }} />
        <Stack.Screen name="update" options={{ title: t('progress.add') }} />
        <Stack.Screen name="money" options={{ title: t('mymoney.title') }} />
        <Stack.Screen name="spend" options={{ title: t('mymoney.recordSpend') }} />
      </Stack>
    </RoleGate>
  );
}
