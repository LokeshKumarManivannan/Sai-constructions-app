import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/files/PhotoPicker';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Project } from '@/lib/types';
import { BigButton, ChipPicker, ErrorText, Field, Muted } from '@/ui/components';

/** Fill in the missing details of a payment: site, category, reason, bill photo. */
export function TagForm({ e, onSaved }: { e: Expense; onSaved: () => void }) {
  const { t } = useTranslation();
  const projects = useApi<Project[]>('/projects');
  const [projectId, setProjectId] = useState<string>(e.project_id ?? 'none');
  const [category, setCategory] = useState<ExpenseCategory | null>(e.category);
  const [reason, setReason] = useState(e.reason ?? '');
  const [bill, setBill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        project_id: projectId === 'none' ? null : projectId,
        category,
        reason: reason || null,
      };
      if (bill) body.bill_file_id = bill;
      await api(`/expenses/${e.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ps = projects.data ?? [];
  return (
    <>
      <Muted>{t('books.site')}</Muted>
      <ChipPicker
        options={['none', ...ps.map((p) => p.id)]}
        value={projectId}
        onChange={setProjectId}
        labelOf={(id) => (id === 'none' ? t('books.noSite') : ps.find((p) => p.id === id)?.name ?? '')}
      />
      <Muted>{t('books.category')}</Muted>
      <ChipPicker options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} labelOf={(c) => t(`ecat.${c}`)} />
      <Field label={t('books.reason')} value={reason} onChangeText={setReason} />
      {!e.bill_url && (
        <PhotoPicker
          projectId={projectId === 'none' ? null : projectId}
          label={t('books.bill')}
          onUploaded={(ids) => setBill(ids[0] ?? null)}
        />
      )}
      <ErrorText>{error}</ErrorText>
      <BigButton label={t('books.saveDetails')} icon="checkmark" onPress={save} busy={busy} />
    </>
  );
}
