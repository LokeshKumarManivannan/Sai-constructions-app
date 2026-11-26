import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

type Item = { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; href: Href };

/** Owner menu: every list and the downloads, one tap each. */
export default function OwnerMenu() {
  const { t } = useTranslation();
  const groups: Item[][] = [
    [
      { icon: 'business', label: t('menu.projects'), href: '/owner' },
      { icon: 'person', label: t('menu.customers'), href: '/owner/customers' },
      { icon: 'people', label: t('menu.supervisors'), href: '/owner/supervisors' },
    ],
    [
      { icon: 'create', label: t('books.paySomeone'), href: '/owner/pay-out' },
      { icon: 'list', label: t('menu.allPayments'), href: '/owner/books' },
      { icon: 'people-circle', label: t('menu.payees'), href: '/owner/payees' },
      { icon: 'wallet', label: t('menu.cashBox'), href: '/owner/cashbook' },
    ],
    [{ icon: 'download', label: t('menu.downloads'), href: '/owner/downloads' }],
  ];

  return (
    <Screen>
      {groups.map((items, gi) => (
        <View key={gi} style={{ backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={() => (it.href === '/owner' ? router.dismissTo('/owner') : router.push(it.href))}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, minHeight: 60 },
                i > 0 && { borderTopWidth: 1, borderColor: colors.border },
                pressed && { backgroundColor: colors.bg },
              ]}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={it.icon} size={20} color={colors.brand} />
              </View>
              <Text style={{ flex: 1, fontSize: font.body + 1, fontWeight: '600' }}>{it.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}
