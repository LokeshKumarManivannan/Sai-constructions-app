import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { formatINR, rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Milestone, Project } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, StatusChip, Title } from '@/ui/components';
import { milestoneTone } from '@/ui/status';
import { colors, font, space } from '@/ui/theme';

export function MilestonesSection({ project }: { project: Project }) {
  const { t } = useTranslation();
  const { data, reload } = useApi<Milestone[]>(`/projects/${project.id}/milestones`);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = (data ?? []).reduce((s, m) => s + m.amount_due_paise, 0);
  const mismatch = data && data.length > 0 && total !== project.contract_value_paise;

  async function add() {
    const paise = rupeesToPaise(amount);
    if (paise === null) return setError(t('owner.invalidAmount'));
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/milestones`, { method: 'POST', body: { name, amount_due_paise: paise } });
      setName('');
      setAmount('');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Milestone) {
    try {
      await api(`/milestones/${m.id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card>
      <Title>{t('owner.milestones')}</Title>
      {data?.map((m) => (
        <View
          key={m.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingVertical: space.xs, borderBottomWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ width: 28, fontSize: font.body, color: colors.muted }}>{m.seq}.</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: font.body, fontWeight: '600' }}>{m.name}</Text>
            <StatusChip label={t(`status.${m.status}`)} tone={milestoneTone[m.status]} />
          </View>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>{formatINR(m.amount_due_paise)}</Text>
          {m.status === 'pending' && (
            <Pressable accessibilityLabel={t('common.remove')} onPress={() => remove(m)} hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color={colors.bad} />
            </Pressable>
          )}
        </View>
      ))}
      <Muted>
        {t('owner.milestonesTotal')}: {formatINR(total)}
      </Muted>
      {mismatch && <ErrorText>{t('owner.milestonesMismatch', { value: formatINR(project.contract_value_paise) })}</ErrorText>}
      <Field label={t('owner.milestoneName')} value={name} onChangeText={setName} />
      <Field label={t('owner.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <ErrorText>{error}</ErrorText>
      <BigButton label={t('owner.addMilestone')} icon="add" onPress={add} busy={busy} disabled={!name || !amount} />
    </Card>
  );
}
