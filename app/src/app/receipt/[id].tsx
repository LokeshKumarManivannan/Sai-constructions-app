import { Text } from '@/ui/Text';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Receipt } from '@/lib/types';
import { BigButton, Card, ErrorText, Loading, Muted, Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: font.small, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: font.body, color: colors.text, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function ReceiptScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, error } = useApi<Receipt>(`/payments/${id}/receipt`);
  if (!r) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: font.title, fontWeight: '800', color: colors.brand }}>{t('company')}</Text>
        <Muted>
          {t('payments.receipt')} · {t('payments.receiptNo')} {r.receipt_no}
        </Muted>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.good, marginVertical: space.s }}>
          {formatINR(r.amount_paise)}
        </Text>
        <Line label={t('owner.name')} value={r.customer_name} />
        <Line label={t('owner.projectName')} value={r.project_name} />
        {!!r.site_address && <Line label={t('owner.siteAddress')} value={r.site_address} />}
        <Line label={t('payments.mode')} value={t(`mode.${r.mode}`)} />
        {r.reference && <Line label={t('payments.reference')} value={r.reference} />}
        <Line label={t('payments.datePaid')} value={showDate(r.paid_on)} />
        {r.milestone_name && <Line label={t('payments.milestone')} value={r.milestone_name} />}
        <Line label={t('pstatus.confirmed')} value={showDate(r.confirmed_at)} />
      </Card>
      {Platform.OS === 'web' && <BigButton label={t('payments.print')} icon="print" variant="secondary" onPress={() => globalThis.print?.()} />}
    </Screen>
  );
}
