import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { TRADES, type Assignment, type Trade, type User } from '@/lib/types';
import { BigButton, Card, ChipPicker, ErrorText, Muted, Title } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

export function TeamSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const team = useApi<Assignment[]>(`/projects/${projectId}/assignments`);
  const sups = useApi<User[]>('/supervisors');
  const [userId, setUserId] = useState<string | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setError(null);
    try {
      await api(`/projects/${projectId}/assignments`, { method: 'POST', body: { user_id: userId, trade } });
      setUserId(null);
      setTrade(null);
      await team.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function unassign(a: Assignment) {
    await api(`/assignments/${a.id}`, { method: 'DELETE' });
    await team.reload();
  }

  const supNames = Object.fromEntries((sups.data ?? []).map((s) => [s.id, s.full_name]));

  return (
    <Card>
      <Title>{t('owner.team')}</Title>
      {team.data?.length === 0 && <Muted>{t('owner.noTeam')}</Muted>}
      {team.data?.map((a) => (
        <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Ionicons name="construct" size={20} color={colors.muted} />
          <Text style={{ flex: 1, fontSize: font.body }}>
            {t(`trade.${a.trade}`)} — {a.user_name}
          </Text>
          <Pressable accessibilityLabel={t('common.remove')} onPress={() => unassign(a)} hitSlop={10}>
            <Ionicons name="close-circle-outline" size={24} color={colors.bad} />
          </Pressable>
        </View>
      ))}
      {(sups.data?.length ?? 0) > 0 && (
        <>
          <Muted>{t('owner.pickSupervisor')}</Muted>
          <ChipPicker
            options={(sups.data ?? []).map((s) => s.id)}
            value={userId}
            onChange={setUserId}
            labelOf={(id) => supNames[id] ?? id}
          />
          <Muted>{t('owner.pickTrade')}</Muted>
          <ChipPicker options={TRADES} value={trade} onChange={setTrade} labelOf={(tr) => t(`trade.${tr}`)} />
          <ErrorText>{error}</ErrorText>
          <BigButton label={t('owner.assign')} icon="person-add" onPress={assign} disabled={!userId || !trade} />
        </>
      )}
    </Card>
  );
}
