import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { BooksSummary } from '@/lib/types';
import { HeroCard } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  return h < 12 ? t('owner.morning') : h < 17 ? t('owner.afternoon') : t('owner.evening');
}

function Shortcut({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.s }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={{ color: colors.brandText, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Owner home hero: cash in hand, payments missing details, and the money shortcuts. */
export function BooksCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useApi<BooksSummary>('/books/summary');
  const cash = data?.cash_in_hand_paise ?? 0;

  return (
    <HeroCard>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.body }}>
        {greeting(t)}, {user?.full_name?.split(' ')[0]}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small, marginTop: space.s }}>{t('books.cashInHand')}</Text>
      <Text style={{ color: cash < 0 ? '#FF9B8F' : colors.brandText, fontSize: font.big + 4, fontWeight: '800' }}>{formatINR(cash)}</Text>

      {data && data.untagged_count > 0 ? (
        <Pressable
          onPress={() => router.push('/owner/untagged')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.accent, borderRadius: radius.control, padding: space.s + 2 }}
        >
          <Ionicons name="receipt" size={22} color={colors.brandDeep} />
          <Text style={{ flex: 1, color: colors.brandDeep, fontWeight: '700', fontSize: font.body }}>{t('books.fixUntagged', { n: data.untagged_count })}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.brandDeep} />
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name="checkmark-circle" size={20} color="#7FD3A6" />
          <Text style={{ color: '#7FD3A6', fontWeight: '600' }}>{t('books.allFixed')}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', marginTop: space.s, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingTop: space.s }}>
        <Shortcut icon="arrow-up-circle" label={t('books.paySomeone')} onPress={() => router.push('/owner/pay-out')} />
        <Shortcut icon="wallet" label={t('books.cashBook')} onPress={() => router.push('/owner/cashbook')} />
        <Shortcut icon="stats-chart" label={t('books.ledger')} onPress={() => router.push('/owner/books')} />
        <Shortcut icon="people-circle" label={t('books.payees')} onPress={() => router.push('/owner/payees')} />
      </View>
    </HeroCard>
  );
}
