import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { Summary } from '@/lib/types';
import { Card, Muted, SpeakButton } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

function BigAmount({ label, paise, color, icon }: { label: string; paise: number; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={{ fontSize: font.small, color: colors.muted, fontWeight: '600' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: font.big, fontWeight: '800', color }}>{formatINR(paise)}</Text>
    </View>
  );
}

/** Total / Paid / Balance in big type, plus the next payment due (UX rule 3). */
export function SummaryCard({ s, showCash = false }: { s: Summary; showCash?: boolean }) {
  const { t } = useTranslation();
  const nd = s.next_due;
  const spoken = [
    `${t('payments.total')} ${formatINR(s.total_due_paise)}`,
    `${t('payments.paid')} ${formatINR(s.paid_paise)}`,
    `${t('payments.outstanding')} ${formatINR(s.outstanding_paise)}`,
    nd ? `${t('payments.nextPayment')} ${formatINR(nd.amount_paise)} ${t('payments.for')} ${nd.name}` : t('payments.noneDue'),
  ].join('. ');

  return (
    <>
      <Card>
        <BigAmount label={t('payments.total')} paise={s.total_due_paise} color={colors.text} icon="wallet" />
        {s.approved_extras_paise > 0 && (
          <Muted>
            {t('payments.extras')}: {formatINR(s.approved_extras_paise)}
          </Muted>
        )}
        <BigAmount label={t('payments.paid')} paise={s.paid_paise} color={colors.good} icon="checkmark-circle" />
        <BigAmount label={t('payments.outstanding')} paise={s.outstanding_paise} color={colors.bad} icon="alert-circle" />
        {showCash && (
          <Muted>
            {t('payments.cashReceived')}: {formatINR(s.cash_received_paise)} / {formatINR(s.cash_limit_paise)}
          </Muted>
        )}
        <SpeakButton text={spoken} />
      </Card>
      <View
        style={{
          backgroundColor: nd ? colors.badBg : colors.goodBg,
          borderRadius: 12,
          padding: space.m,
          gap: space.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name={nd ? 'calendar' : 'happy'} size={26} color={nd ? colors.bad : colors.good} />
          <Text style={{ fontSize: font.body, fontWeight: '700', color: nd ? colors.bad : colors.good }}>
            {nd ? t('payments.nextPayment') : t('payments.noneDue')}
          </Text>
        </View>
        {nd && (
          <>
            <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.bad }}>{formatINR(nd.amount_paise)}</Text>
            <Text style={{ fontSize: font.body, color: colors.text }}>
              {t('payments.for')}: {nd.name}
            </Text>
            {nd.due_date && (
              <Text style={{ fontSize: font.body, color: colors.text }}>
                {t('payments.dueBy')}: {showDate(nd.due_date)}
              </Text>
            )}
          </>
        )}
      </View>
    </>
  );
}
