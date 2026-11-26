import { Text } from '@/ui/Text';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import type { Payment, PaymentStatus, Role } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, IconLabel, Muted, Row, StatusChip, type Tone } from '@/ui/components';
import { colors, font } from '@/ui/theme';

const tone: Record<PaymentStatus, Tone> = { unconfirmed: 'warn', confirmed: 'good', disputed: 'bad', void: 'neutral' };

export function PaymentRow({ p, viewer, onChanged }: { p: Payment; viewer: Role; onChanged: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'idle' | 'confirm' | 'dispute'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: 'POST', body });
      setStep('idle');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const struck = p.status === 'void';
  return (
    <Card>
      <Row>
        <Text style={{ fontSize: font.title, fontWeight: '800', color: struck ? colors.muted : colors.text, textDecorationLine: struck ? 'line-through' : 'none' }}>
          {formatINR(p.amount_paise)}
        </Text>
        <StatusChip label={t(`pstatus.${p.status}`)} tone={tone[p.status]} />
      </Row>
      <IconLabel icon={p.mode === 'cash' ? 'cash' : 'card'}>
        {t(`mode.${p.mode}`)} · {showDate(p.paid_on)}
      </IconLabel>
      {p.reference && <IconLabel icon="pricetag">{p.reference}</IconLabel>}
      {p.milestone_name && <IconLabel icon="flag">{p.milestone_name}</IconLabel>}
      {p.note && <Muted>{p.note}</Muted>}
      <Muted>
        {t('payments.loggedBy')}: {p.logged_by_name}
      </Muted>
      {p.dispute_reason && <ErrorText>{p.dispute_reason}</ErrorText>}
      {p.proof_url && (
        <Pressable onPress={() => openUrl(p.proof_url!)}>
          <Image source={{ uri: p.proof_url }} style={{ width: 96, height: 96, borderRadius: 8 }} resizeMode="cover" />
        </Pressable>
      )}

      {p.status === 'confirmed' && (
        <BigButton
          label={`${t('payments.receipt')} #${p.receipt_no}`}
          icon="receipt"
          variant="secondary"
          onPress={() => router.push(`/receipt/${p.id}`)}
        />
      )}

      {p.can_confirm && step === 'idle' && (
        <>
          <BigButton
            label={viewer === 'customer' ? t('payments.confirmCustomer') : t('payments.confirm')}
            icon="checkmark-circle"
            onPress={() => setStep('confirm')}
          />
          <BigButton label={t('payments.dispute')} icon="close-circle" variant="danger" onPress={() => setStep('dispute')} />
        </>
      )}
      {step === 'confirm' && (
        <View style={{ gap: 8, padding: 8, backgroundColor: colors.goodBg, borderRadius: 10 }}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>
            {t('payments.confirmQuestion')} {formatINR(p.amount_paise)} · {t(`mode.${p.mode}`)}
          </Text>
          <BigButton label={t('payments.yesConfirm')} icon="checkmark-done" onPress={() => act(`/payments/${p.id}/confirm`)} busy={busy} />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setStep('idle')} />
        </View>
      )}
      {step === 'dispute' && (
        <>
          <Field label={t('payments.disputeReason')} value={reason} onChangeText={setReason} multiline />
          <BigButton
            label={t('payments.sendDispute')}
            icon="send"
            variant="danger"
            onPress={() => act(`/payments/${p.id}/dispute`, { reason })}
            busy={busy}
            disabled={reason.trim().length < 3}
          />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setStep('idle')} />
        </>
      )}

      {viewer === 'owner' && (p.status === 'disputed' || (p.status === 'unconfirmed' && p.logged_by_role === 'owner')) && (
        <BigButton
          label={t('payments.correct')}
          icon="create"
          variant="secondary"
          onPress={() => router.push({ pathname: '/owner/payment', params: { projectId: p.project_id, correctsId: p.id } })}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
