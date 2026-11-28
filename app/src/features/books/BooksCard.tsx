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

const soft = 'rgba(255,255,255,0.78)';

function Figure({ label, paise, icon, color }: { label: string; paise: number; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ color: soft, fontSize: 14 }} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={{ color: colors.brandText, fontSize: font.title + 1, fontWeight: '800' }} numberOfLines={1}>
        {formatINR(paise)}
      </Text>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.s }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={{ color: colors.brandText, fontSize: 13, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Owner home hero: this month's money in and out, what customers still owe, and payments missing details. */
export function BooksCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useApi<BooksSummary>('/books/summary');

  return (
    <HeroCard>
      <Text style={{ color: soft, fontSize: font.body }}>
        {greeting(t)}, {user?.full_name?.split(' ')[0]}
      </Text>

      <Text style={{ color: soft, fontSize: font.small, marginTop: space.s }}>{t('books.toCollect')}</Text>
      <Text style={{ color: colors.brandText, fontSize: font.big + 2, fontWeight: '800' }} numberOfLines={1}>
        {formatINR(data?.to_collect_paise ?? 0)}
      </Text>

      <View style={{ flexDirection: 'row', gap: space.m, marginTop: space.xs }}>
        <Figure label={t('books.receivedMonth')} paise={data?.received_month_paise ?? 0} icon="arrow-down-circle" color="#9BE0B8" />
        <Figure label={t('books.spentMonth')} paise={data?.spent_month_paise ?? 0} icon="arrow-up-circle" color={colors.accent} />
      </View>

      {data && data.untagged_count > 0 && (
        <Pressable
          onPress={() => router.push('/owner/untagged')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: colors.accent, borderRadius: radius.control, padding: space.s + 2, marginTop: space.xs }}
        >
          <Ionicons name="receipt" size={22} color={colors.text} />
          <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: font.body }}>{t('books.fixUntagged', { n: data.untagged_count })}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', marginTop: space.xs, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingTop: space.s }}>
        <Shortcut icon="arrow-down-circle" label={t('books.moneyIn')} onPress={() => router.push('/owner/payment')} />
        <Shortcut icon="arrow-up-circle" label={t('books.paySomeone')} onPress={() => router.push('/owner/pay-out')} />
        <Shortcut icon="stats-chart" label={t('books.ledger')} onPress={() => router.push('/owner/books')} />
        <Shortcut icon="download" label={t('books.downloadsShort')} onPress={() => router.push('/owner/downloads')} />
      </View>
    </HeroCard>
  );
}
