import { Text } from '@/ui/Text';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import type { ChangeOrder, ChangeOrderStatus, Role } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, Row, SpeakButton, StatusChip, type Tone } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

const tone: Record<ChangeOrderStatus, Tone> = {
  draft: 'neutral',
  sent: 'warn',
  approved: 'good',
  rejected: 'bad',
  in_progress: 'good',
  done: 'good',
};

export function ChangeOrderCard({ co, viewer, onChanged }: { co: ChangeOrder; viewer: Role; onChanged: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, method = 'POST', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(`/change-orders/${co.id}${path}`, { method, body });
      setStep('idle');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const waitingOnCustomer = viewer === 'customer' && co.status === 'sent';
  return (
    <Card>
      <Row>
        <StatusChip label={t(`cstatus.${co.status}`)} tone={tone[co.status]} />
        {co.trade && <Muted>{t(`trade.${co.trade}`)}</Muted>}
        {co.version > 1 && <Muted>{t('extra.version', { v: co.version })}</Muted>}
      </Row>
      <Text style={{ fontSize: font.body + 1, fontWeight: '700', color: colors.text }}>{co.title}</Text>
      {!!co.description && <Text style={{ fontSize: font.body, color: colors.text }}>{co.description}</Text>}
      <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.text }}>+ {formatINR(co.amount_paise)}</Text>
      {co.photo_urls.length > 0 && (
        <Row>
          {co.photo_urls.map((u) => (
            <Pressable key={u} onPress={() => openUrl(u)}>
              <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 8 }} />
            </Pressable>
          ))}
        </Row>
      )}
      {co.decided_by_name && co.status !== 'rejected' && co.status !== 'sent' && (
        <Muted>{t('extra.approvedBy', { name: co.decided_by_name })}</Muted>
      )}
      {co.status === 'rejected' && (
        <>
          {co.decided_by_name && <Muted>{t('extra.rejectedBy', { name: co.decided_by_name })}</Muted>}
          {co.reject_reason && <ErrorText>{co.reject_reason}</ErrorText>}
        </>
      )}

      {waitingOnCustomer && step === 'idle' && (
        <>
          <SpeakButton text={`${co.title}. ${formatINR(co.amount_paise)}. ${t('extra.decide')}`} />
          <BigButton label={t('extra.approve')} icon="checkmark-circle" onPress={() => setStep('approve')} />
          <BigButton label={t('extra.reject')} icon="close-circle" variant="danger" onPress={() => setStep('reject')} />
        </>
      )}
      {step === 'approve' && (
        <View style={{ gap: space.s, padding: space.s, backgroundColor: colors.goodBg, borderRadius: 10 }}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>
            {t('extra.approveQuestion', { amount: formatINR(co.amount_paise) })}
          </Text>
          <BigButton label={t('extra.yesApprove')} icon="checkmark-done" onPress={() => act('/approve')} busy={busy} />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setStep('idle')} />
        </View>
      )}
      {step === 'reject' && (
        <>
          <Field label={t('extra.rejectReason')} value={reason} onChangeText={setReason} multiline />
          <BigButton
            label={t('extra.sendReject')}
            icon="close"
            variant="danger"
            onPress={() => act('/reject', 'POST', { reason: reason || null })}
            busy={busy}
          />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setStep('idle')} />
        </>
      )}

      {viewer === 'owner' && co.status === 'draft' && (
        <Row>
          <BigButton label={t('extra.send')} icon="send" onPress={() => act('/send')} busy={busy} />
          <BigButton label={t('extra.delete')} icon="trash" variant="danger" onPress={() => act('', 'DELETE')} />
        </Row>
      )}
      {viewer === 'owner' && co.status === 'approved' && (
        <BigButton label={t('extra.start')} icon="hammer" variant="secondary" onPress={() => act('/start')} busy={busy} />
      )}
      {viewer === 'owner' && (co.status === 'approved' || co.status === 'in_progress') && (
        <BigButton label={t('extra.complete')} icon="checkmark-done" variant="secondary" onPress={() => act('/complete')} busy={busy} />
      )}
      {viewer === 'owner' && co.status === 'rejected' && (
        <BigButton label={t('extra.revise')} icon="create" variant="secondary" onPress={() => act('/revise')} busy={busy} />
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
