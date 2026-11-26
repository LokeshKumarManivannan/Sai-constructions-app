import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { HeaderTitle, headerOptions } from '@/ui/header';
import { colors, family } from '@/ui/theme';

// Four big tabs, icon + word (UX rule 2).
export default function CustomerTabs() {
  const { t } = useTranslation();
  const icon =
    (name: ComponentProps<typeof Ionicons>['name']) =>
    ({ color }: { color: ColorValue }) => <Ionicons name={name} size={30} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        headerTitle: () => <HeaderTitle title={t('company')} />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontFamily: family.bold },
        tabBarStyle: { height: 74, paddingTop: 6, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: colors.card },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('customer.money'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="progress" options={{ title: t('customer.progress'), tabBarIcon: icon('images') }} />
      <Tabs.Screen name="documents" options={{ title: t('customer.documents'), tabBarIcon: icon('document-text') }} />
      <Tabs.Screen name="help" options={{ title: t('customer.help'), tabBarIcon: icon('call') }} />
    </Tabs>
  );
}
