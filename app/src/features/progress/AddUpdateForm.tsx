import { useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

import { PhotoPicker } from '@/features/payments/PhotoPicker';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { Milestone, Role, Trade } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted } from '@/ui/components';

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null; // location is a nice-to-have, never block an update
  }
}

export function AddUpdateForm({
  projectId,
  trades,
  role,
  onSaved,
}: {
  projectId: string;
  trades: Trade[];
  role: Role;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const milestones = useApi<Milestone[]>(role === 'owner' ? `/projects/${projectId}/milestones` : null);
  const [trade, setTrade] = useState<Trade | null>(trades.length === 1 ? trades[0] : null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!photos.length && !note.trim()) return setError(t('progress.needPhoto'));
    setBusy(true);
    setError(null);
    try {
      const pos = Platform.OS === 'web' ? null : await currentPosition();
      await api(`/projects/${projectId}/progress`, {
        method: 'POST',
        body: { trade, note, photo_file_ids: photos, milestone_id: milestoneId, lat: pos?.lat ?? null, lng: pos?.lng ?? null },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ms = milestones.data ?? [];
  return (
    <Card>
      {trades.length > 1 && (
        <>
          <Muted>{t('progress.trade')}</Muted>
          <ChipPicker options={trades} value={trade} onChange={setTrade} labelOf={(tr) => t(`trade.${tr}`)} />
        </>
      )}
      <PhotoPicker projectId={projectId} label={t('progress.photos')} onUploaded={setPhotos} multiple />
      <Field label={t('progress.note')} value={note} onChangeText={setNote} multiline />
      {ms.length > 0 && (
        <>
          <Muted>{t('progress.stage')}</Muted>
          <ChipPicker
            options={ms.map((m) => m.id)}
            value={milestoneId}
            onChange={(id) => setMilestoneId(id === milestoneId ? null : id)}
            labelOf={(id) => ms.find((m) => m.id === id)?.name ?? ''}
          />
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <BigButton label={t('progress.save')} icon="cloud-upload" onPress={save} busy={busy} disabled={!trade} />
    </Card>
  );
}
