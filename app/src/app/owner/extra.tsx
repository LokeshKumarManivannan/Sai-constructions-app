import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/files/PhotoPicker';
import { api } from '@/lib/api';
import { rupeesToPaise } from '@/lib/money';
import { TRADES, type ChangeOrder, type Trade } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Screen } from '@/ui/components';

export default function NewExtraWork() {
  const { t } = useTranslation();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(sendNow: boolean) {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError(t('owner.invalidAmount'));
    setBusy(true);
    setError(null);
    try {
      const co = await api<ChangeOrder>(`/projects/${projectId}/change-orders`, {
        method: 'POST',
        body: { trade, title, description, amount_paise: paise, photo_file_ids: photos },
      });
      if (sendNow) await api(`/change-orders/${co.id}/send`, { method: 'POST' });
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
        <Muted>{t('extra.trade')}</Muted>
        <ChipPicker options={TRADES} value={trade} onChange={setTrade} labelOf={(tr) => t(`trade.${tr}`)} />
        <Field label={t('extra.what')} value={title} onChangeText={setTitle} />
        <Field label={t('extra.details')} value={description} onChangeText={setDescription} multiline />
        <Field label={t('extra.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <PhotoPicker projectId={projectId} label={t('extra.photos')} onUploaded={setPhotos} multiple />
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('extra.saveSend')} icon="send" onPress={() => save(true)} busy={busy} disabled={!title || !amount} />
        <BigButton label={t('extra.saveDraft')} variant="secondary" onPress={() => save(false)} busy={busy} disabled={!title || !amount} />
      </Card>
    </Screen>
  );
}
