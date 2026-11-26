import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR, rupeesToPaise } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Milestone, MilestoneStatus, Project } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, Muted, Row, StatusChip, Title } from '@/ui/components';
import { milestoneTone } from '@/ui/status';
import { colors, font, space } from '@/ui/theme';
import { DateField } from '@/ui/DateField';

function MilestoneItem({ m, onChanged, onError }: { m: Milestone; onChanged: () => void; onError: (e: string) => void }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [due, setDue] = useState<string | null | ''>('');

  async function move(status: MilestoneStatus, due_date?: string) {
    try {
      await api(`/milestones/${m.id}/status`, { method: 'POST', body: { status, due_date: due_date || null } });
      setAsking(false);
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function remove() {
    try {
      await api(`/milestones/${m.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <View style={{ gap: space.s, paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Text style={{ width: 28, fontSize: font.body, color: colors.muted }}>{m.seq}.</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: font.body, fontWeight: '600' }}>{m.name}</Text>
          <Row>
            <StatusChip label={t(`status.${m.status}`)} tone={milestoneTone[m.status]} />
            {m.due_date && <Muted>{showDate(m.due_date)}</Muted>}
          </Row>
        </View>
        <Text style={{ fontSize: font.body, fontWeight: '700' }}>{formatINR(m.amount_due_paise)}</Text>
        {m.status === 'pending' && (
          <Pressable accessibilityLabel={t('common.remove')} onPress={remove} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={colors.bad} />
          </Pressable>
        )}
      </View>
      {m.status === 'pending' && <BigButton label={t('payments.markDone')} icon="hammer" variant="secondary" onPress={() => move('done')} />}
      {m.status === 'done' && !asking && (
        <Row>
          <BigButton label={t('payments.markDue')} icon="cash" onPress={() => setAsking(true)} />
          <BigButton label={t('payments.undo')} variant="secondary" onPress={() => move('pending')} />
        </Row>
      )}
      {asking && (
        <>
          <DateField label={t('payments.dueDate')} onChange={setDue} />
          <BigButton
            label={t('payments.markDue')}
            icon="send"
            onPress={() => move('payment_due', due || undefined)}
            disabled={due === null}
          />
        </>
      )}
      {m.status === 'payment_due' && <BigButton label={t('payments.undo')} variant="secondary" onPress={() => move('done')} />}
    </View>
  );
}

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

  return (
    <Card>
      <Title>{t('owner.milestones')}</Title>
      {data?.map((m) => (
        <MilestoneItem key={m.id} m={m} onChanged={reload} onError={setError} />
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
