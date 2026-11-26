import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RoleGate } from '@/auth/RoleGate';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { HeaderTitle, headerOptions } from '@/ui/header';
import { colors } from '@/ui/theme';

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="owner">
      <Stack screenOptions={headerOptions}>
        <Stack.Screen
          name="index"
          options={{
            headerTitle: () => <HeaderTitle title={t('company')} />,
            headerLeft: () => (
              <Pressable accessibilityLabel={t('menu.title')} onPress={() => router.push('/owner/menu')} hitSlop={10} style={{ marginLeft: 14, marginRight: 4 }}>
                <Ionicons name="menu" size={28} color={colors.brandText} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="menu" options={{ title: t('menu.title') }} />
        <Stack.Screen name="downloads" options={{ title: t('menu.downloads') }} />
        <Stack.Screen name="customers/index" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="customers/[id]" options={{ title: t('owner.customers') }} />
        <Stack.Screen name="projects/new" options={{ title: t('owner.newProject') }} />
        <Stack.Screen name="projects/[id]" options={{ title: t('owner.projects') }} />
        <Stack.Screen name="payment" options={{ title: t('books.moneyIn') }} />
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
