import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { HeaderTitle, headerOptions } from '@/ui/header';

export default function SupervisorLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="supervisor">
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="index" options={{ headerTitle: () => <HeaderTitle title={t('supervisor.mySites')} /> }} />
        <Stack.Screen name="site/[id]" options={{ title: t('progress.title') }} />
        <Stack.Screen name="update" options={{ title: t('progress.add') }} />
        <Stack.Screen name="money" options={{ title: t('mymoney.title') }} />
        <Stack.Screen name="spend" options={{ title: t('mymoney.recordSpend') }} />
      </Stack>
    </RoleGate>
  );
}
