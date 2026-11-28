import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { useApi } from '@/lib/useApi';
import type { Trade } from '@/lib/types';
import { Card, ChipPicker, Muted, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, space } from '@/ui/theme';

type State = 'not_started' | 'ongoing' | 'done';
type Row = { trade: Trade; state: State; changed_at: string | null };

const LOOK: Record<State, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  not_started: { icon: 'ellipse-outline', color: colors.muted },
  ongoing: { icon: 'construct', color: colors.warn },
  done: { icon: 'checkmark-circle', color: colors.good },
};

/** Which work is going on: civil, plumbing, electrical, carpentry, painting. The owner taps to change it. */
export function TradeBoard({ projectId, editable = false }: { projectId: string; editable?: boolean }) {
  const { t } = useTranslation();
  const board = useApi<Row[]>(`/projects/${projectId}/trades`);
  const [rows, setRows] = useState<Row[] | null>(null);
  const data = rows ?? board.data ?? [];

  async function set(trade: Trade, state: State) {
    setRows(await api<Row[]>(`/projects/${projectId}/trades/${trade}`, { method: 'PUT', body: { state } }));
  }

  return (
    <Card>
      <Title>{t('work.title')}</Title>
      {data.map((r) => {
        const look = LOOK[r.state];
        return (
          <View key={r.trade} style={{ gap: space.xs, paddingVertical: space.s, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Ionicons name={look.icon} size={24} color={look.color} />
              <Text style={{ flex: 1, fontSize: font.body + 1, fontWeight: '700' }}>{t(`trade.${r.trade}`)}</Text>
              {!editable && <Text style={{ color: look.color, fontWeight: '700' }}>{t(`work.${r.state}`)}</Text>}
            </View>
            {editable && (
              <ChipPicker options={['not_started', 'ongoing', 'done'] as State[]} value={r.state} onChange={(s) => set(r.trade, s)} labelOf={(s) => t(`work.${s}`)} />
            )}
            {r.changed_at && r.state !== 'not_started' && <Muted>{t('work.since', { date: showDate(r.changed_at.slice(0, 10)) })}</Muted>}
          </View>
        );
      })}
    </Card>
  );
}
