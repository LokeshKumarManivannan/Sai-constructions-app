import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import { PAYEE_TYPES, type Payee, type PayeeType } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, IconLabel, Screen, Title } from '@/ui/components';

export default function Payees() {
  const { t } = useTranslation();
  const { data, reload } = useApi<Payee[]>('/payees');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<PayeeType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    try {
      await api('/payees', { method: 'POST', body: { name, phone: phone || null, type } });
      setName('');
      setPhone('');
      setType(null);
      setError(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Card>
        <Title>{t('books.newPayee')}</Title>
        <Field label={t('books.payeeName')} value={name} onChangeText={setName} />
        <Field label={t('owner.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <ChipPicker options={PAYEE_TYPES.filter((x) => x !== 'supervisor')} value={type} onChange={setType} labelOf={(x) => t(`ptype.${x}`)} />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('common.add')} icon="person-add" onPress={add} disabled={!name || !type} />
      </Card>
      {data?.map((p) => (
        <Card key={p.id}>
          <IconLabel icon="person">{`${p.name} · ${t(`ptype.${p.type}`)}`}</IconLabel>
          {p.phone && <IconLabel icon="call">{p.phone}</IconLabel>}
          <IconLabel icon="cash">{formatINR(p.total_paid_paise)}</IconLabel>
        </Card>
      ))}
    </Screen>
  );
}
