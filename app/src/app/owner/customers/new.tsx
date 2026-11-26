import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Screen } from '@/ui/components';

export default function NewCustomer() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', phone: '', alt_phone: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const c = await api<Customer>('/customers', {
        method: 'POST',
        body: { ...form, alt_phone: form.alt_phone || null, address: form.address || null, notes: form.notes || null },
      });
      router.replace(`/owner/customers/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label={t('owner.name')} value={form.name} onChangeText={set('name')} />
        <Field label={t('owner.phone')} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label={t('owner.altPhone')} value={form.alt_phone} onChangeText={set('alt_phone')} keyboardType="phone-pad" />
        <Field label={t('owner.address')} value={form.address} onChangeText={set('address')} multiline />
        <Field label={t('owner.notes')} value={form.notes} onChangeText={set('notes')} multiline />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('common.save')} icon="checkmark" onPress={save} busy={busy} disabled={!form.name || !form.phone} />
      </Card>
    </Screen>
  );
}
