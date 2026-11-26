import { Text } from '@/ui/Text';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Expense, MyMoney } from '@/lib/types';
import { BigButton, Card, IconLabel, Loading, Muted, Screen, SpeakButton, StatusChip, Title } from '@/ui/components';
import { colors, font } from '@/ui/theme';

function ReceivedRow({ e, onChanged }: { e: Expense; onChanged: () => void }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  return (
    <Card>
      <Text style={{ fontSize: font.title, fontWeight: '800' }}>{formatINR(e.amount_paise)}</Text>
      <IconLabel icon={e.mode === 'cash' ? 'cash' : 'card'}>{`${t(`omode.${e.mode}`)} · ${showDate(e.paid_on)}`}</IconLabel>
      {e.category && <IconLabel icon="pricetag">{t(`ecat.${e.category}`)}</IconLabel>}
      {e.reason && <Muted>{e.reason}</Muted>}
      {e.recipient_confirmed_at ? (
        <StatusChip label={t('mymoney.confirmed')} tone="good" />
      ) : asking ? (
        <BigButton
          label={t('payments.yesConfirm')}
          icon="checkmark-done"
          onPress={async () => {
            await api(`/expenses/${e.id}/acknowledge`, { method: 'POST' });
            onChanged();
          }}
        />
      ) : (
        <BigButton label={t('mymoney.confirm')} icon="checkmark-circle" onPress={() => setAsking(true)} />
      )}
    </Card>
  );
}

export default function MyMoneyScreen() {
  const { t } = useTranslation();
  const { data, reload } = useApi<MyMoney>('/me/money');
  if (!data) return <Loading />;
  const a = data.advance;
  return (
    <Screen>
      <Card>
        <Muted>{t('mymoney.holding')}</Muted>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: a.holding_paise < 0 ? colors.bad : colors.text }}>
          {formatINR(a.holding_paise)}
        </Text>
        <Muted>{`${t('mymoney.given')} ${formatINR(a.given_paise)} · ${t('mymoney.spent')} ${formatINR(a.spent_paise)}`}</Muted>
        <SpeakButton text={`${t('mymoney.holding')} ${formatINR(a.holding_paise)}`} />
      </Card>
      <BigButton label={t('mymoney.recordSpend')} icon="add-circle" onPress={() => router.push('/supervisor/spend')} />
      <Title>{t('mymoney.received')}</Title>
      {data.received.length === 0 && <Muted>{t('books.noEntries')}</Muted>}
      {data.received.map((e) => (
        <ReceivedRow key={e.id} e={e} onChanged={reload} />
      ))}
      <Title>{t('mymoney.spends')}</Title>
      {data.my_spends.length === 0 && <Muted>{t('books.noEntries')}</Muted>}
      {data.my_spends.map((e) => (
        <Card key={e.id}>
          <Text style={{ fontSize: font.body + 2, fontWeight: '800' }}>{formatINR(e.amount_paise)}</Text>
          <IconLabel icon="person">{e.payee_name}</IconLabel>
          <IconLabel icon="home">{`${e.project_name ?? ''} · ${showDate(e.paid_on)}`}</IconLabel>
          {e.reason && <Muted>{e.reason}</Muted>}
        </Card>
      ))}
    </Screen>
  );
}
