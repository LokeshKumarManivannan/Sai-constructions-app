import { Text } from '@/ui/Text';
import { useState } from 'react';
import { Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import type { Expense } from '@/lib/types';
import { BigButton, Card, IconLabel, Muted, Row, StatusChip } from '@/ui/components';
import { colors, font } from '@/ui/theme';
import { TagForm } from './TagForm';

export function missingParts(e: Expense, t: (k: string) => string): string[] {
  const m: string[] = [];
  if (!e.project_id && e.category !== 'advance') m.push(t('books.missingSite'));
  if (!e.category) m.push(t('books.missingCategory'));
  if (!e.reason) m.push(t('books.missingReason'));
  if (!e.bill_url) m.push(t('books.missingBill'));
  return m;
}

/** One payment out, as the owner sees it. `startOpen` shows the details form straight away. */
export function ExpenseCard({ e, onChanged, startOpen = false }: { e: Expense; onChanged: () => void; startOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(startOpen);
  const missing = missingParts(e, t);
  const voided = e.status === 'void';

  async function voidIt() {
    await api(`/expenses/${e.id}/void`, { method: 'POST' });
    onChanged();
  }

  return (
    <Card>
      <Row>
        <Text style={{ fontSize: font.title, fontWeight: '800', color: voided ? colors.muted : colors.text, textDecorationLine: voided ? 'line-through' : 'none' }}>
          {formatINR(e.amount_paise)}
        </Text>
        {voided ? (
          <StatusChip label={t('books.voided')} tone="neutral" />
        ) : e.tagged ? (
          <StatusChip label="✓" tone="good" />
        ) : (
          <StatusChip label={t('books.missing', { what: missing.join(', ') })} tone="bad" />
        )}
      </Row>
      <IconLabel icon="person">
        {e.payee_name}
        {e.payee_type ? ` · ${t(`ptype.${e.payee_type}`)}` : ''}
      </IconLabel>
      <IconLabel icon={e.mode === 'cash' ? 'cash' : 'card'}>
        {t(`omode.${e.mode}`)} · {showDate(e.paid_on)}
        {e.bank_txn_id ? ` · ${e.bank_txn_id}` : ''}
      </IconLabel>
      {(e.project_name || e.category) && (
        <IconLabel icon="home">
          {[e.project_name, e.category ? t(`ecat.${e.category}`) : null, e.trade ? t(`trade.${e.trade}`) : null].filter(Boolean).join(' · ')}
        </IconLabel>
      )}
      {e.reason && <Muted>{e.reason}</Muted>}
      {e.recipient_confirmed_at && <StatusChip label={t('books.confirmed')} tone="good" />}
      {e.bill_url && (
        <Pressable onPress={() => openUrl(e.bill_url!)}>
          <Image source={{ uri: e.bill_url }} style={{ width: 80, height: 80, borderRadius: 8 }} />
        </Pressable>
      )}
      {!voided && !e.tagged && !open && <BigButton label={t('books.fix')} icon="create" onPress={() => setOpen(true)} />}
      {!voided && open && (
        <TagForm
          e={e}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
      {!voided && e.tagged && <BigButton label={t('books.void')} icon="close" variant="danger" onPress={voidIt} />}
    </Card>
  );
}
