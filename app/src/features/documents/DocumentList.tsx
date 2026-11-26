import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import { DOC_GROUPS, type DocumentItem, type Role } from '@/lib/types';
import { BigButton, Card, Muted, StatusChip, Title } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

/** Documents grouped by section as large tiles (UX rule 2). Owner also sees visibility and can toggle it. */
export function DocumentList({ projectId, viewer }: { projectId: string; viewer: Role }) {
  const { t } = useTranslation();
  const { data, reload } = useApi<DocumentItem[]>(`/projects/${projectId}/documents`);

  async function toggle(d: DocumentItem) {
    await api(`/documents/${d.id}/visibility`, {
      method: 'POST',
      body: { visibility: d.visibility === 'customer' ? 'internal' : 'customer' },
    });
    await reload();
  }

  const docs = data ?? [];
  if (data && docs.length === 0) return <Muted>{t('docs.none')}</Muted>;
  return (
    <>
      {DOC_GROUPS.filter((g) => docs.some((d) => d.group === g)).map((g) => (
        <View key={g} style={{ gap: space.s }}>
          <Title>{t(`dgroup.${g}`)}</Title>
          {docs
            .filter((d) => d.group === g)
            .map((d) => (
              <Card key={d.id}>
                <Pressable onPress={() => d.url && openUrl(d.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <Ionicons name={d.content_type === 'application/pdf' ? 'document-text' : 'image'} size={40} color={colors.brand} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: font.body, fontWeight: '700' }}>{d.title}</Text>
                    <Muted>{t(`dtype.${d.doc_type}`, { defaultValue: d.doc_type })}</Muted>
                    {d.versions > 1 && <Muted>{t('docs.version', { v: d.version })}</Muted>}
                  </View>
                  <Ionicons name="open-outline" size={24} color={colors.muted} />
                </Pressable>
                {viewer === 'owner' && (
                  <>
                    <StatusChip
                      label={d.visibility === 'customer' ? t('docs.visible') : t('docs.hidden')}
                      tone={d.visibility === 'customer' ? 'good' : 'neutral'}
                    />
                    <BigButton
                      label={d.visibility === 'customer' ? t('docs.makeHidden') : t('docs.makeVisible')}
                      icon={d.visibility === 'customer' ? 'eye-off' : 'eye'}
                      variant="secondary"
                      onPress={() => toggle(d)}
                    />
                  </>
                )}
              </Card>
            ))}
        </View>
      ))}
    </>
  );
}
