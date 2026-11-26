import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/files/PhotoPicker';
import { api } from '@/lib/api';
import { isIsoDate, today } from '@/lib/dates';
import { rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import {
  EXPENSE_CATEGORIES,
  OUT_MODES,
  PAYEE_TYPES,
  TRADES,
  type ExpenseCategory,
  type OutMode,
  type Payee,
  type PayeeType,
  type Project,
  type Trade,
} from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Screen, Title } from '@/ui/components';

export default function PayOut() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const payees = useApi<Payee[]>(`/payees${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const projects = useApi<Project[]>('/projects');
  const [payee, setPayee] = useState<Payee | null>(null);
  const [newPayee, setNewPayee] = useState<{ name: string; type: PayeeType | null } | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<OutMode | null>(null);
  const [txn, setTxn] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [projectId, setProjectId] = useState<string>('none');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [reason, setReason] = useState('');
  const [bill, setBill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choosePayee(p: Payee) {
    setPayee(p);
    setNewPayee(null);
    if (p.default_project_id) setProjectId(p.default_project_id);
    if (p.default_category) setCategory(p.default_category);
  }

  async function save() {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError(t('owner.invalidAmount'));
    if (!isIsoDate(paidOn)) return setError(t('books.date'));
    setBusy(true);
    setError(null);
    try {
      let p = payee;
      if (!p && newPayee?.name && newPayee.type) {
        p = await api<Payee>('/payees', { method: 'POST', body: { name: newPayee.name, type: newPayee.type } });
      }
      if (!p) throw new Error(t('books.payee'));
      await api('/expenses', {
        method: 'POST',
        body: {
          payee_id: p.id,
          amount_paise: paise,
          mode,
          paid_on: paidOn,
          bank_txn_id: txn || null,
          project_id: projectId === 'none' ? null : projectId,
          category,
          trade,
          reason: reason || null,
          bill_file_id: bill,
        },
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ps = projects.data ?? [];
  return (
    <Screen>
      <Card>
        <Title>{t('books.payee')}</Title>
        {payee ? (
          <>
            <Muted>{`${payee.name} · ${t(`ptype.${payee.type}`)}`}</Muted>
            <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setPayee(null)} />
          </>
        ) : newPayee ? (
          <>
            <Field label={t('books.payeeName')} value={newPayee.name} onChangeText={(v) => setNewPayee({ ...newPayee, name: v })} />
            <ChipPicker options={PAYEE_TYPES.filter((x) => x !== 'supervisor')} value={newPayee.type} onChange={(v) => setNewPayee({ ...newPayee, type: v })} labelOf={(x) => t(`ptype.${x}`)} />
          </>
        ) : (
          <>
            <Field label={t('books.searchPayee')} value={q} onChangeText={setQ} />
            <ChipPicker
              options={(payees.data ?? []).slice(0, 12).map((p) => p.id)}
              value={null}
              onChange={(id) => choosePayee(payees.data!.find((p) => p.id === id)!)}
              labelOf={(id) => payees.data?.find((p) => p.id === id)?.name ?? ''}
            />
            <BigButton label={t('books.newPayee')} icon="person-add" variant="secondary" onPress={() => setNewPayee({ name: q, type: null })} />
          </>
        )}
      </Card>
      <Card>
        <Field label={t('books.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Muted>{t('books.mode')}</Muted>
        <ChipPicker options={OUT_MODES} value={mode} onChange={setMode} labelOf={(m) => t(`omode.${m}`)} />
        {mode !== 'cash' && <Field label={t('books.txnId')} value={txn} onChangeText={setTxn} autoCapitalize="characters" />}
        <Field label={t('books.date')} value={paidOn} onChangeText={setPaidOn} />
        <Muted>{t('books.site')}</Muted>
        <ChipPicker
          options={['none', ...ps.map((p) => p.id)]}
          value={projectId}
          onChange={setProjectId}
          labelOf={(id) => (id === 'none' ? t('books.noSite') : ps.find((p) => p.id === id)?.name ?? '')}
        />
        <Muted>{t('books.category')}</Muted>
        <ChipPicker options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} labelOf={(c) => t(`ecat.${c}`)} />
        <Muted>{t('books.trade')}</Muted>
        <ChipPicker options={TRADES} value={trade} onChange={(v) => setTrade(v === trade ? null : v)} labelOf={(x) => t(`trade.${x}`)} />
        <Field label={t('books.reason')} value={reason} onChangeText={setReason} />
        <PhotoPicker projectId={projectId === 'none' ? null : projectId} label={t('books.bill')} onUploaded={(ids) => setBill(ids[0] ?? null)} />
        <ErrorText>{error}</ErrorText>
        <BigButton
          label={t('books.save')}
          icon="checkmark"
          onPress={save}
          busy={busy}
          disabled={!amount || !mode || (!payee && !(newPayee?.name && newPayee.type))}
        />
      </Card>
    </Screen>
  );
}
