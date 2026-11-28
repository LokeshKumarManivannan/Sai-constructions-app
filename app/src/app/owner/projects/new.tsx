import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { inviteAndText } from '@/features/project/sendInvite';
import { rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Customer, Project } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Screen, Title } from '@/ui/components';
import { DateField } from '@/ui/DateField';

type Who = 'new' | 'existing';

/** One form for a new project. Customer details go in here too; pick an existing customer only for their second project. */
export default function NewProject() {
  const { t } = useTranslation();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const [who, setWho] = useState<Who>(customerId ? 'existing' : 'new');
  const [q, setQ] = useState('');
  const customers = useApi<Customer[]>(who === 'existing' ? `/customers${q ? `?q=${encodeURIComponent(q)}` : ''}` : null);
  const [existingId, setExistingId] = useState<string | null>(customerId ?? null);
  const [cust, setCust] = useState({ name: '', phone: '', alt_phone: '', address: '' });
  const [proj, setProj] = useState({ name: '', site_address: '', google_maps_url: '', plot_size: '', floors: '', contract_value: '' });
  const [start, setStart] = useState<string | null | ''>('');
  const [end, setEnd] = useState<string | null | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setC = (k: keyof typeof cust) => (v: string) => setCust((f) => ({ ...f, [k]: v }));
  const setP = (k: keyof typeof proj) => (v: string) => setProj((f) => ({ ...f, [k]: v }));
  // Suggest a project name from the customer's name until the owner types one.
  const placeholderName = who === 'new' && cust.name ? `${cust.name} house` : '';

  async function save() {
    const paise = proj.contract_value ? rupeesToPaise(proj.contract_value) : 0;
    if (paise === null) return setError(t('owner.invalidAmount'));
    if (start === null || end === null) return setError(t('common.badDate'));
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>('/projects/with-customer', {
        method: 'POST',
        body: {
          ...(who === 'existing'
            ? { customer_id: existingId }
            : { customer: { name: cust.name, phone: cust.phone, alt_phone: cust.alt_phone || null, address: cust.address || null } }),
          project: {
            name: proj.name || placeholderName,
            site_address: proj.site_address,
            google_maps_url: proj.google_maps_url || null,
            plot_size: proj.plot_size || null,
            floors: proj.floors || null,
            contract_value_paise: paise,
            start_date: start || null,
            target_end_date: end || null,
          },
        },
      });
      router.replace(`/owner/projects/${p.id}`);
      // Invite the customer straight away: the Messages app opens with the text ready to send.
      await inviteAndText(p.id, t).catch(() => undefined); // the project exists either way; invite again from Overview
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const list = customers.data ?? [];
  const customerReady = who === 'existing' ? !!existingId : !!cust.name && !!cust.phone;

  return (
    <Screen>
      <Card>
        <Title>{t('owner.customer')}</Title>
        <ChipPicker
          options={['new', 'existing'] as Who[]}
          value={who}
          onChange={setWho}
          labelOf={(w) => (w === 'new' ? t('owner.newCustomer') : t('owner.existingCustomer'))}
        />
        {who === 'new' ? (
          <>
            <Field label={t('owner.name')} value={cust.name} onChangeText={setC('name')} />
            <Field label={t('owner.phone')} value={cust.phone} onChangeText={setC('phone')} keyboardType="phone-pad" placeholder="98765 43210" />
            <Field label={t('owner.altPhone')} value={cust.alt_phone} onChangeText={setC('alt_phone')} keyboardType="phone-pad" />
            <Field label={t('owner.address')} value={cust.address} onChangeText={setC('address')} multiline />
          </>
        ) : (
          <>
            <Field label={t('owner.searchCustomers')} value={q} onChangeText={setQ} />
            {list.length === 0 && customers.data && <Muted>{t('owner.noCustomers')}</Muted>}
            <ChipPicker
              options={list.map((c) => c.id)}
              value={existingId}
              onChange={setExistingId}
              labelOf={(id) => {
                const c = list.find((x) => x.id === id);
                return c ? `${c.name} · ${c.phone.slice(-4)}` : '';
              }}
            />
          </>
        )}
      </Card>

      <Card>
        <Title>{t('owner.projectDetails')}</Title>
        <Field label={t('owner.projectName')} value={proj.name} onChangeText={setP('name')} placeholder={placeholderName} />
        <Field label={t('owner.siteAddress')} value={proj.site_address} onChangeText={setP('site_address')} multiline />
        <Field label={t('owner.mapsUrl')} value={proj.google_maps_url} onChangeText={setP('google_maps_url')} autoCapitalize="none" />
        <Field label={t('owner.plotSize')} value={proj.plot_size} onChangeText={setP('plot_size')} />
        <Field label={t('owner.floors')} value={proj.floors} onChangeText={setP('floors')} />
        <Field label={t('owner.contractValue')} value={proj.contract_value} onChangeText={setP('contract_value')} keyboardType="decimal-pad" />
        <DateField label={t('owner.startDate')} onChange={setStart} />
        <DateField label={t('owner.targetEndDate')} onChange={setEnd} />
        <ErrorText>{error}</ErrorText>
        <BigButton
          label={t('owner.createProject')}
          icon="checkmark"
          onPress={save}
          busy={busy}
          disabled={!customerReady || !(proj.name || placeholderName)}
        />
      </Card>
    </Screen>
  );
}
