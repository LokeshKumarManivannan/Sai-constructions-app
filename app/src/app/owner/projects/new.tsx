import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { rupeesToPaise } from '@/lib/money';
import type { Project } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Screen } from '@/ui/components';

export default function NewProject() {
  const { t } = useTranslation();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [form, setForm] = useState({
    name: '',
    site_address: '',
    google_maps_url: '',
    plot_size: '',
    floors: '',
    contract_value: '',
    start_date: '',
    target_end_date: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const paise = form.contract_value ? rupeesToPaise(form.contract_value) : 0;
    if (paise === null) return setError(t('owner.invalidAmount'));
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>('/projects', {
        method: 'POST',
        body: {
          customer_id: customerId,
          name: form.name,
          site_address: form.site_address,
          google_maps_url: form.google_maps_url || null,
          plot_size: form.plot_size || null,
          floors: form.floors || null,
          contract_value_paise: paise,
          start_date: form.start_date || null,
          target_end_date: form.target_end_date || null,
        },
      });
      router.replace(`/owner/projects/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label={t('owner.projectName')} value={form.name} onChangeText={set('name')} />
        <Field label={t('owner.siteAddress')} value={form.site_address} onChangeText={set('site_address')} multiline />
        <Field label={t('owner.mapsUrl')} value={form.google_maps_url} onChangeText={set('google_maps_url')} autoCapitalize="none" />
        <Field label={t('owner.plotSize')} value={form.plot_size} onChangeText={set('plot_size')} />
        <Field label={t('owner.floors')} value={form.floors} onChangeText={set('floors')} />
        <Field label={t('owner.contractValue')} value={form.contract_value} onChangeText={set('contract_value')} keyboardType="decimal-pad" />
        <Field label={t('owner.startDate')} value={form.start_date} onChangeText={set('start_date')} />
        <Field label={t('owner.targetEndDate')} value={form.target_end_date} onChangeText={set('target_end_date')} />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('common.save')} icon="checkmark" onPress={save} busy={busy} disabled={!form.name} />
      </Card>
    </Screen>
  );
}
