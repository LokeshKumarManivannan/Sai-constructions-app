import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { isIsoDate, showDate, today } from '@/lib/dates';
import { formatINR, rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { CashEntry } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Title } from '@/ui/components';
import { Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

type Kind = 'withdrawal' | 'deposit' | 'adjustment';

export default function CashBook() {
  const { t } = useTranslation();
  const { data, reload } = useApi<{ balance_paise: number; entries: CashEntry[] }>('/cash-book');
  const [kind, setKind] = useState<Kind>('withdrawal');
  const [amount, setAmount] = useState('');
  const [onDate, setOnDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const negative = kind === 'adjustment' && amount.trim().startsWith('-');
    const paise = rupeesToPaise(amount.replace('-', ''));
    if (!paise || !isIsoDate(onDate)) return setError(t('owner.invalidAmount'));
    try {
      await api('/cash-transfers', { method: 'POST', body: { kind, amount_paise: negative ? -paise : paise, on_date: onDate, note: note || null } });
      setAmount('');
      setNote('');
      setError(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const label = (k: string) =>
    ({ withdrawal: t('books.withdrawal'), deposit: t('books.deposit'), adjustment: t('books.adjustment'), expense: t('books.spent'), customer_cash: t('books.received') })[k] ?? k;

  return (
    <Screen>
      <Card>
        <Muted>{t('books.cashInHand')}</Muted>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: (data?.balance_paise ?? 0) < 0 ? colors.bad : colors.text }}>
          {formatINR(data?.balance_paise ?? 0)}
        </Text>
      </Card>
      <Card>
        <Title>{t('books.addCash')}</Title>
        <ChipPicker options={['withdrawal', 'deposit', 'adjustment'] as Kind[]} value={kind} onChange={setKind} labelOf={label} />
        <Field label={t('books.amount')} value={amount} onChangeText={setAmount} keyboardType="numbers-and-punctuation" />
        <Field label={t('books.date')} value={onDate} onChangeText={setOnDate} />
        <Field label={t('books.note')} value={note} onChangeText={setNote} />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('common.add')} icon="add" onPress={add} disabled={!amount} />
      </Card>
      <Card>
        {data?.entries.length === 0 && <Muted>{t('books.noEntries')}</Muted>}
        {data?.entries.map((e) => (
          <View key={`${e.kind}-${e.ref_id}`} style={{ flexDirection: 'row', gap: space.s, paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: font.body, fontWeight: '600' }}>{e.label}</Text>
              <Muted>{`${label(e.kind)} · ${showDate(e.on_date)}`}</Muted>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: font.body, fontWeight: '800', color: e.direction === 'in' ? colors.good : colors.bad }}>
                {e.direction === 'in' ? '+' : '−'} {formatINR(e.amount_paise)}
              </Text>
              <Muted>{`${t('books.balance')} ${formatINR(e.balance_paise)}`}</Muted>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
