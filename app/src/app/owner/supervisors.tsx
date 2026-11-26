import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { callNumber } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { User } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, IconLabel, Title } from '@/ui/components';
import { Screen } from '@/ui/components';

export default function Supervisors() {
  const { t } = useTranslation();
  const { data, reload } = useApi<User[]>('/supervisors');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api('/supervisors', { method: 'POST', body: { full_name: name, phone } });
      setName('');
      setPhone('');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Title>{t('owner.newSupervisor')}</Title>
        <Field label={t('owner.name')} value={name} onChangeText={setName} />
        <Field label={t('owner.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('common.add')} icon="person-add" onPress={add} busy={busy} disabled={!name || !phone} />
      </Card>
      {data?.map((s) => (
        <Card key={s.id} onPress={() => callNumber(s.phone)}>
          <IconLabel icon="person">{s.full_name}</IconLabel>
          <IconLabel icon="call">{s.phone}</IconLabel>
        </Card>
      ))}
    </Screen>
  );
}
