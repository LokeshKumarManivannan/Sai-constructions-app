import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { BankTxn } from '@/lib/types';
import { Muted } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, radius, space } from '@/ui/theme';

/** One bank line: money out (red arrow up) or in (green arrow down), who, and what the app thinks it is. */
export function BankRow({ t: x, onPress }: { t: BankTxn; onPress: () => void }) {
  const { t } = useTranslation();
  const out = x.direction === 'debit';
  const s = x.suggestion;
  const hint =
    x.linked?.label ??
    (s?.kind === 'cash'
      ? t('bank.looksCash')
      : s && (s.payee_name || s.project_name)
        ? t('bank.looksLike', { what: [s.payee_name, s.project_name].filter(Boolean).join(' · ') })
        : null);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', gap: space.m, padding: space.m, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={out ? 'arrow-up-circle' : 'arrow-down-circle'} size={30} color={out ? colors.bad : colors.good} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s }}>
          <Text style={{ fontSize: font.body, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {x.counterparty || x.narration}
          </Text>
          <Text style={{ fontSize: font.body, fontWeight: '800', color: out ? colors.text : colors.good }}>
            {out ? '−' : '+'}
            {formatINR(x.amount_paise)}
          </Text>
        </View>
        <Muted>{showDate(x.txn_date)}</Muted>
        {hint && (
          <Text style={{ fontSize: font.small, color: x.linked ? colors.good : colors.brand, fontWeight: '600' }} numberOfLines={1}>
            {x.linked ? '✓ ' : ''}
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
