import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useNotifications, type Notification } from '@/features/notifications/useNotifications';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Empty, Loading, Muted, Screen, SpeakButton } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const LOOK: Record<Notification['kind'], { icon: Icon; color: string; href: Href }> = {
  payment_due: { icon: 'cash', color: colors.warn, href: '/customer' },
  extra_work: { icon: 'construct', color: colors.warn, href: '/customer' },
  check_payment: { icon: 'help-circle', color: colors.warn, href: '/customer' },
  payment_confirmed: { icon: 'checkmark-circle', color: colors.good, href: '/customer' },
  photos: { icon: 'images', color: colors.brand, href: '/customer/progress' },
  document: { icon: 'document-text', color: colors.brand, href: '/customer/documents' },
};

export default function CustomerNotifications() {
  const { t } = useTranslation();
  const { items, isNew, markSeen, loading } = useNotifications();

  // Opening the list marks news as read (things waiting on the customer stay until done).
  useEffect(() => {
    if (!loading) void markSeen();
  }, [loading, markSeen]);

  const text = (n: Notification) =>
    t(`notify.${n.kind}`, {
      amount: n.amount_paise != null ? formatINR(n.amount_paise) : '',
      name: n.kind === 'photos' && n.name ? t(`trade.${n.name}`) : n.name ?? '',
      date: n.due_date ? showDate(n.due_date) : '',
    });

  if (loading && !items.length) return <Loading />;
  return (
    <Screen>
      {items.length === 0 && <Empty icon="notifications-off-outline">{t("notify.none")}</Empty>}
      {items.length > 0 && <SpeakButton text={items.filter((n) => n.action).map(text).join('. ') || text(items[0])} />}
      {items.map((n) => {
        const look = LOOK[n.kind];
        const fresh = isNew(n);
        return (
          <Pressable
            key={n.id}
            onPress={() => router.push(look.href)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                gap: space.m,
                padding: space.m,
                borderRadius: radius.card,
                backgroundColor: n.action ? colors.warnBg : colors.card,
                borderWidth: 1,
                borderColor: fresh ? look.color : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name={look.icon} size={28} color={look.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: font.body, fontWeight: fresh ? '700' : '500' }}>{text(n)}</Text>
              <Muted>{`${n.project_name} · ${showDate(n.at.slice(0, 10))}`}</Muted>
            </View>
            {fresh && !n.action && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 }} />}
          </Pressable>
        );
      })}
    </Screen>
  );
}
