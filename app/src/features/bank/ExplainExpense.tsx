import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/files/PhotoPicker';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  EXPENSE_CATEGORIES,
  PAYEE_TYPES,
  TRADES,
  type BankTxn,
  type ExpenseCategory,
  type Payee,
  type PayeeType,
  type Project,
  type Trade,
} from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Title } from '@/ui/components';

/** "Business payment": who was paid, which site, what for. Prefilled from payee memory / site code. */
export function ExplainExpense({ txn, onDone }: { txn: BankTxn; onDone: () => void }) {
  const { t } = useTranslation();
  const s = txn.suggestion;
  const [q, setQ] = useState('');
  const payees = useApi<Payee[]>(`/payees${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const projects = useApi<Project[]>('/projects');
  const [payee, setPayee] = useState<{ id: string; name: string } | null>(s?.payee_id ? { id: s.payee_id, name: s.payee_name ?? '' } : null);
  const [newPayee, setNewPayee] = useState<{ name: string; type: PayeeType | null } | null>(null);
  const [projectId, setProjectId] = useState<string>(s?.project_id ?? 'none');
  const [category, setCategory] = useState<ExpenseCategory | null>(s?.category ?? null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [reason, setReason] = useState('');
  const [bill, setBill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/bank/txns/${txn.id}/expense`, {
        method: 'POST',
        body: {
          payee_id: payee?.id ?? null,
          new_payee: !payee && newPayee?.name && newPayee.type ? { name: newPayee.name, type: newPayee.type } : null,
          project_id: projectId === 'none' ? null : projectId,
          category,
          trade,
          reason: reason || null,
          bill_file_id: bill,
        },
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ps = projects.data ?? [];
  return (
    <Card>
      <Title>{t('bank.business')}</Title>
      <Muted>{t('books.payee')}</Muted>
      {payee ? (
        <ChipPicker options={[payee.id]} value={payee.id} onChange={() => setPayee(null)} labelOf={() => `${payee.name}  ✕`} />
      ) : newPayee ? (
        <>
          <Field label={t('books.payeeName')} value={newPayee.name} onChangeText={(v) => setNewPayee({ ...newPayee, name: v })} />
          <ChipPicker
            options={PAYEE_TYPES.filter((x) => x !== 'supervisor')}
            value={newPayee.type}
            onChange={(v) => setNewPayee({ ...newPayee, type: v })}
            labelOf={(x) => t(`ptype.${x}`)}
          />
        </>
      ) : (
        <>
          <Field label={t('books.searchPayee')} value={q} onChangeText={setQ} />
          <ChipPicker
            options={(payees.data ?? []).slice(0, 12).map((p) => p.id)}
            value={null}
            onChange={(id) => {
              const p = payees.data!.find((x) => x.id === id)!;
              setPayee({ id: p.id, name: p.name });
              if (p.default_project_id && projectId === 'none') setProjectId(p.default_project_id);
              if (p.default_category && !category) setCategory(p.default_category);
            }}
            labelOf={(id) => payees.data?.find((p) => p.id === id)?.name ?? ''}
          />
          <BigButton
            label={t('books.newPayee')}
            icon="person-add"
            variant="secondary"
            onPress={() => setNewPayee({ name: q || txn.counterparty || '', type: null })}
          />
        </>
      )}
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
        disabled={!category || (!payee && !(newPayee?.name && newPayee.type))}
      />
    </Card>
  );
}
