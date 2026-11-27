import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useNotifications, type Notification } from './useNotifications';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { Empty, Loading, Muted, Screen, SpeakButton } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
type Viewer = 'customer' | 'owner';
type Tab = 'money' | 'extra' | 'progress' | 'documents' | 'expenses' | 'bank';
const LOOK: Record<Notification['kind'], { icon: Icon; color: string; tab: Tab }> = {
  payment_due: { icon: 'cash', color: colors.warn, tab: 'money' },
  extra_work: { icon: 'construct', color: colors.warn, tab: 'money' },
  check_payment: { icon: 'help-circle', color: colors.warn, tab: 'money' },
  payment_confirmed: { icon: 'checkmark-circle', color: colors.good, tab: 'money' },
  photos: { icon: 'images', color: colors.brand, tab: 'progress' },
  document: { icon: 'document-text', color: colors.brand, tab: 'documents' },
  confirm_payment: { icon: 'help-circle', color: colors.warn, tab: 'money' },
  disputed: { icon: 'alert-circle', color: colors.bad, tab: 'money' },
  overdue: { icon: 'time', color: colors.bad, tab: 'money' },
  untagged: { icon: 'receipt', color: colors.warn, tab: 'expenses' },
  extra_decided: { icon: 'construct', color: colors.good, tab: 'extra' },
  supervisor_spent: { icon: 'wallet', color: colors.brand, tab: 'expenses' },
  bank_to_explain: { icon: 'business', color: colors.warn, tab: 'bank' },
  bank_statement_due: { icon: 'cloud-upload', color: colors.warn, tab: 'bank' },
};

function target(viewer: Viewer, n: Notification): Href {
  const tab = LOOK[n.kind].tab;
  if (viewer === 'customer') return tab === 'progress' || tab === 'documents' ? (`/customer/${tab}` as Href) : '/customer';
  if (n.kind === 'untagged') return '/owner/untagged';
  if (tab === 'bank') return '/owner/bank';
  return { pathname: '/owner/projects/[id]', params: { id: n.project_id!, tab } };
}

/** The notifications list for a customer or the owner. */
export function NotificationList({ viewer }: { viewer: Viewer }) {
  const { t } = useTranslation();
  const { items, isNew, markSeen, loading } = useNotifications();

  // Opening the list marks news as read (things waiting on the customer stay until done).
  useEffect(() => {
    if (!loading) void markSeen();
  }, [loading, markSeen]);

  const text = (n: Notification) =>
    t(`notify.${n.kind}${n.status ? `_${n.status}` : ''}${viewer === 'owner' && n.kind === 'photos' ? '_owner' : ''}`, {
      amount: n.amount_paise != null ? formatINR(n.amount_paise) : '',
      name: n.kind === 'photos' && n.name ? t(`trade.${n.name}`) : n.name ?? '',
      date: n.due_date ? showDate(n.due_date) : '',
      by: n.by ?? '',
      count: n.count ?? 0,
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
            onPress={() => router.push(target(viewer, n))}
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
              <Muted>{[n.project_name, showDate(n.at.slice(0, 10))].filter(Boolean).join(' · ')}</Muted>
            </View>
            {fresh && !n.action && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 6 }} />}
          </Pressable>
        );
      })}
    </Screen>
  );
}
