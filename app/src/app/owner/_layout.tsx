import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { headerOptions } from '@/ui/header';

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="owner">
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="index" options={{ title: t('company') }} />
        <Stack.Screen name="customers/index" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="customers/[id]" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="projects/new" options={{ title: t('owner.newProject') }} />
        <Stack.Screen name="projects/[id]" options={{ title: t('owner.projects') }} />
        <Stack.Screen name="payment" options={{ title: t('payments.log') }} />
        <Stack.Screen name="extra" options={{ title: t('extra.add') }} />
        <Stack.Screen name="update" options={{ title: t('progress.add') }} />
        <Stack.Screen name="pay-out" options={{ title: t('books.paySomeone') }} />
        <Stack.Screen name="untagged" options={{ title: t('books.untagged') }} />
        <Stack.Screen name="cashbook" options={{ title: t('books.cashBook') }} />
        <Stack.Screen name="books" options={{ title: t('books.title') }} />
        <Stack.Screen name="payees" options={{ title: t('books.payees') }} />
        <Stack.Screen name="document" options={{ title: t('docs.upload') }} />
        <Stack.Screen name="supervisors" options={{ title: t('owner.supervisors') }} />
      </Stack>
    </RoleGate>
  );
}
