import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/files/PhotoPicker';
import { api } from '@/lib/api';
import { isIsoDate, today } from '@/lib/dates';
import { rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { ExpenseCategory, ProjectSite } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Screen } from '@/ui/components';

const CATS: ExpenseCategory[] = ['labour', 'material', 'transport', 'other'];

export default function SupervisorSpend() {
  const { t } = useTranslation();
  const sites = useApi<ProjectSite[]>('/projects');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [paidTo, setPaidTo] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('labour');
  const [reason, setReason] = useState('');
  const [bill, setBill] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ss = sites.data ?? [];
  const site = projectId ?? (ss.length === 1 ? ss[0].id : null);

  async function save() {
    const paise = rupeesToPaise(amount);
    if (!paise || !isIsoDate(paidOn)) return setError(t('owner.invalidAmount'));
    setBusy(true);
    setError(null);
    try {
      await api('/petty-cash/spend', {
        method: 'POST',
        body: { project_id: site, paid_to: paidTo, amount_paise: paise, category, reason, bill_file_id: bill, paid_on: paidOn },
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        {ss.length > 1 && (
          <>
            <Muted>{t('mymoney.site')}</Muted>
            <ChipPicker options={ss.map((s) => s.id)} value={site} onChange={setProjectId} labelOf={(id) => ss.find((s) => s.id === id)?.name ?? ''} />
          </>
        )}
        <Field label={t('mymoney.paidTo')} value={paidTo} onChangeText={setPaidTo} />
        <Field label={t('books.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Muted>{t('books.category')}</Muted>
        <ChipPicker options={CATS} value={category} onChange={setCategory} labelOf={(c) => t(`ecat.${c}`)} />
        <Field label={t('books.reason')} value={reason} onChangeText={setReason} />
        <Field label={t('books.date')} value={paidOn} onChangeText={setPaidOn} />
        {site && <PhotoPicker projectId={site} label={t('books.bill')} onUploaded={(ids) => setBill(ids[0] ?? null)} />}
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('books.save')} icon="checkmark" onPress={save} busy={busy} disabled={!site || !paidTo || !amount || !reason} />
      </Card>
    </Screen>
  );
}
