import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';

import { api, uploadFile } from '@/lib/api';
import { DOC_GROUPS, DOC_TYPES, type DocGroup } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Field, Muted, Screen, StatusChip } from '@/ui/components';

export default function UploadDocument() {
  const { t } = useTranslation();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [group, setGroup] = useState<DocGroup | null>(null);
  const [docType, setDocType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<{ uri: string; name: string; type: string; webFile?: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    setFile({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf', webFile: a.file ?? undefined });
    if (!title) setTitle(docType ? t(`dtype.${docType}`) : a.name.replace(/\.[^.]+$/, ''));
  }

  async function save() {
    if (!file || !group || !docType) return;
    setBusy(true);
    setError(null);
    try {
      const f = await uploadFile(projectId, file);
      await api(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: { group, doc_type: docType, title: title || t(`dtype.${docType}`), file_id: f.id },
      });
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
        <Muted>{t('docs.group')}</Muted>
        <ChipPicker options={DOC_GROUPS} value={group} onChange={(g) => { setGroup(g); setDocType(null); }} labelOf={(g) => t(`dgroup.${g}`)} />
        {group && (
          <>
            <Muted>{t('docs.type')}</Muted>
            <ChipPicker
              options={DOC_TYPES[group]}
              value={docType}
              onChange={(d) => { setDocType(d); setTitle(t(`dtype.${d}`)); }}
              labelOf={(d) => t(`dtype.${d}`)}
            />
          </>
        )}
        <Field label={t('docs.name')} value={title} onChangeText={setTitle} />
        <BigButton label={t('docs.pickFile')} icon="attach" variant="secondary" onPress={pick} />
        {file && <StatusChip label={`${t('docs.fileChosen')}: ${file.name}`} tone="good" />}
        <ErrorText>{error}</ErrorText>
        <BigButton label={t('docs.save')} icon="cloud-upload" onPress={save} busy={busy} disabled={!file || !group || !docType} />
      </Card>
    </Screen>
  );
}
