import { Text } from '@/ui/Text';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';

import { HANDOVER_TA } from './handoverDefaults';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { useApi } from '@/lib/useApi';
import type { Handover, HandoverItem, Role } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, StatusChip, Title } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

function ItemRow({ it, editable, onSet }: { it: HandoverItem; editable: boolean; onSet: (h: Handover) => void }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(it.quantity ?? '');

  async function patch(body: Record<string, unknown>) {
    onSet(await api<Handover>(`/handover/items/${it.id}`, { method: 'PATCH', body }));
  }

  return (
    <View style={{ gap: space.xs, paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.border }}>
      <Pressable
        disabled={!editable}
        onPress={() => patch({ checked: !it.checked })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44 }}
      >
        <Ionicons name={it.checked ? 'checkbox' : 'square-outline'} size={30} color={it.checked ? colors.good : colors.muted} />
        <Text style={{ flex: 1, fontSize: font.body, color: colors.text }}>{(i18n.language === 'ta' && HANDOVER_TA[it.item]) || it.item}</Text>
      </Pressable>
      {editable ? (
        <Field
          label={t('handover.quantity')}
          value={qty}
          onChangeText={setQty}
          onBlur={() => qty !== (it.quantity ?? '') && patch({ quantity: qty || null })}
        />
      ) : (
        it.quantity && <Muted>{it.quantity}</Muted>
      )}
    </View>
  );
}

/** Owner ticks items and fills quantities; the customer signs once every item is ticked. */
export function HandoverSection({ projectId, viewer }: { projectId: string; viewer: Role }) {
  const { t } = useTranslation();
  const { data, reload } = useApi<Handover>(`/projects/${projectId}/handover`);
  const [override, setOverride] = useState<Handover | null>(null);
  const [newItem, setNewItem] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const h = override ?? data;

  async function call(path: string, body?: unknown) {
    setError(null);
    try {
      setOverride(await api<Handover>(path, { method: 'POST', body }));
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!h) return null;
  const signed = !!h.signed_at;
  const done = h.items.filter((i) => i.checked).length;
  const editable = viewer === 'owner' && !signed;

  if (h.items.length === 0) {
    return viewer === 'owner' ? (
      <BigButton label={t('handover.start')} icon="key" onPress={() => call(`/projects/${projectId}/handover/seed`, {})} />
    ) : null;
  }

  return (
    <Card>
      <Title>{t('handover.title')}</Title>
      {signed ? (
        <StatusChip label={t('handover.signed', { name: h.signed_by_name, date: showDate(h.signed_at) })} tone="good" />
      ) : (
        <StatusChip label={t('handover.progress', { done, total: h.items.length })} tone={h.all_checked ? 'good' : 'warn'} />
      )}
      {h.items.map((it) => (
        <ItemRow key={it.id} it={it} editable={editable} onSet={setOverride} />
      ))}
      {editable && (
        <>
          <Field label={t('handover.item')} value={newItem} onChangeText={setNewItem} />
          <BigButton
            label={t('handover.add')}
            icon="add"
            variant="secondary"
            disabled={!newItem}
            onPress={async () => {
              await call(`/projects/${projectId}/handover/items`, { item: newItem });
              setNewItem('');
            }}
          />
        </>
      )}
      {viewer === 'customer' && !signed && !h.all_checked && <Muted>{t('handover.waiting')}</Muted>}
      {viewer === 'customer' && !signed && h.all_checked && !confirming && (
        <BigButton label={t('handover.sign')} icon="create" onPress={() => setConfirming(true)} />
      )}
      {confirming && !signed && (
        <View style={{ gap: space.s, padding: space.s, backgroundColor: colors.goodBg, borderRadius: 10 }}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>{t('handover.signQuestion')}</Text>
          <BigButton label={t('handover.yesSign')} icon="checkmark-done" onPress={() => call(`/projects/${projectId}/handover/sign`)} />
          <BigButton label={t('common.cancel')} variant="secondary" onPress={() => setConfirming(false)} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
