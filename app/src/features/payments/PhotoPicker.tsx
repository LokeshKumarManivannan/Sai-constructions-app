import { useState } from 'react';
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { uploadFile } from '@/lib/api';
import { pickPhoto } from '@/lib/pickPhoto';
import { BigButton, ErrorText, Muted, Row } from '@/ui/components';
import { space } from '@/ui/theme';

/** Camera / gallery buttons that upload straight away and report the file id. */
export function PhotoPicker({
  projectId,
  label,
  onUploaded,
  multiple = false,
}: {
  projectId: string;
  label: string;
  onUploaded: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState<{ id: string; uri: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function take(source: 'camera' | 'library') {
    setError(null);
    const picked = await pickPhoto(source);
    if (!picked) return;
    setBusy(true);
    try {
      const f = await uploadFile(projectId, picked);
      const next = multiple ? [...previews, { id: f.id, uri: picked.uri }] : [{ id: f.id, uri: picked.uri }];
      setPreviews(next);
      onUploaded(next.map((x) => x.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.s }}>
      <Muted>{label}</Muted>
      <Row>
        <BigButton label={t('payments.camera')} icon="camera" variant="secondary" onPress={() => take('camera')} busy={busy} />
        <BigButton label={t('payments.gallery')} icon="images" variant="secondary" onPress={() => take('library')} busy={busy} />
      </Row>
      {previews.length > 0 && (
        <Row>
          {previews.map((p) => (
            <Image key={p.id} source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
          ))}
        </Row>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
