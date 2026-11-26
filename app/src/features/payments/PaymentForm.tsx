import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, ApiError } from '@/lib/api';
import { isIsoDate, today } from '@/lib/dates';
import { formatINR, rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import { PAYMENT_MODES, type Milestone, type PaymentMode, type Role } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Title } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';
import { PhotoPicker } from '@/features/files/PhotoPicker';

interface CashLimit {
  code: 'cash_limit';
  new_total_paise: number;
}

/** Record a customer payment. Customers cannot record cash; only the owner can correct an entry. */
export function PaymentForm({
  projectId,
  role,
  correctsId,
  onSaved,
}: {
  projectId: string;
  role: Role;
  correctsId?: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const milestones = useApi<Milestone[]>(`/projects/${projectId}/milestones`);
  const modes = role === 'customer' ? PAYMENT_MODES.filter((m) => m !== 'cash') : PAYMENT_MODES;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode | null>(role === 'customer' ? 'upi' : null);
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [cashLimit, setCashLimit] = useState<CashLimit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(acknowledge = false) {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError(t('owner.invalidAmount'));
    if (!isIsoDate(paidOn)) return setError(t('payments.paidOn'));
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/payments`, {
        method: 'POST',
        body: {
          amount_paise: paise,
          mode,
          paid_on: paidOn,
          reference: reference || null,
          note: note || null,
          milestone_id: milestoneId,
          proof_file_id: proof,
          corrects_id: correctsId ?? null,
          acknowledge_cash_limit: acknowledge,
        },
      });
      onSaved();
    } catch (e) {
      const d = e instanceof ApiError ? (e.detail as CashLimit | undefined) : undefined;
      if (d && typeof d === 'object' && d.code === 'cash_limit') setCashLimit(d);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ms = milestones.data ?? [];
  return (
    <Card>
      <Title>{role === 'customer' ? t('payments.logCustomer') : t('payments.log')}</Title>
      {correctsId && <Muted>{t('payments.correcting')}</Muted>}
      <Field label={t('payments.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Muted>{t('payments.mode')}</Muted>
      <ChipPicker options={modes} value={mode} onChange={(m) => { setMode(m); setCashLimit(null); }} labelOf={(m) => t(`mode.${m}`)} />
      {mode !== 'cash' && <Field label={t('payments.reference')} value={reference} onChangeText={setReference} autoCapitalize="characters" />}
      <Field label={t('payments.paidOn')} value={paidOn} onChangeText={setPaidOn} />
      {ms.length > 0 && (
        <>
          <Muted>{t('payments.milestone')}</Muted>
          <ChipPicker
            options={ms.map((m) => m.id)}
            value={milestoneId}
            onChange={(id) => setMilestoneId(id === milestoneId ? null : id)}
            labelOf={(id) => ms.find((m) => m.id === id)?.name ?? ''}
          />
        </>
      )}
      <Field label={t('payments.note')} value={note} onChangeText={setNote} />
      <PhotoPicker projectId={projectId} label={t('payments.proof')} onUploaded={(ids) => setProof(ids[0] ?? null)} />

      {cashLimit ? (
        <View style={{ backgroundColor: colors.warnBg, borderRadius: 10, padding: space.m, gap: space.s }}>
          <Text style={{ fontSize: font.body, fontWeight: '800', color: colors.warn }}>{t('payments.cashLimitTitle')}</Text>
          <Text style={{ fontSize: font.body, color: colors.text }}>
            {t('payments.cashLimitBody', { total: formatINR(cashLimit.new_total_paise) })}
          </Text>
          <BigButton label={t('payments.recordAnyway')} icon="warning" variant="danger" onPress={() => save(true)} busy={busy} />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setCashLimit(null)} />
        </View>
      ) : (
        <BigButton label={t('payments.save')} icon="checkmark" onPress={() => save()} busy={busy} disabled={!amount || !mode} />
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
