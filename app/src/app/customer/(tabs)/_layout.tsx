import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { HeaderActions } from '@/ui/HeaderActions';
import { colors } from '@/ui/theme';

// Four big tabs, icon + word (UX rule 2).
export default function CustomerTabs() {
  const { t } = useTranslation();
  const icon =
    (name: ComponentProps<typeof Ionicons>['name']) =>
    ({ color }: { color: ColorValue }) => <Ionicons name={name} size={30} color={color as string} />;

  return (
    <Tabs
      screenOptions={{
        headerTitle: t('company'),
        headerRight: () => <HeaderActions />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
        tabBarStyle: { height: 72, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('customer.money'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="progress" options={{ title: t('customer.progress'), tabBarIcon: icon('images') }} />
      <Tabs.Screen name="documents" options={{ title: t('customer.documents'), tabBarIcon: icon('document-text') }} />
      <Tabs.Screen name="help" options={{ title: t('customer.help'), tabBarIcon: icon('call') }} />
    </Tabs>
  );
}
