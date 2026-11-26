import { Text } from '@/ui/Text';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { showDate } from '@/lib/dates';
import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import { TRADES, type ProgressUpdate, type Trade } from '@/lib/types';
import { Card, ChipPicker, Loading, Muted, Row, SpeakButton, StatusChip } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

/** Newest-first photo timeline with trade filter chips. `trades` limits the filter (supervisors). */
export function ProgressTimeline({ projectId, trades = TRADES }: { projectId: string; trades?: Trade[] }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Trade | 'all'>('all');
  const { data, loading } = useApi<ProgressUpdate[]>(
    `/projects/${projectId}/progress${filter === 'all' ? '' : `?trade=${filter}`}`,
  );

  const spoken = (data ?? [])
    .slice(0, 3)
    .map((u) => `${showDate(u.taken_at)}, ${t(`trade.${u.trade}`)}. ${u.note}`)
    .join('. ');

  return (
    <>
      {trades.length > 1 && (
        <ChipPicker
          options={['all', ...trades] as (Trade | 'all')[]}
          value={filter}
          onChange={setFilter}
          labelOf={(k) => (k === 'all' ? t('progress.all') : t(`trade.${k}`))}
        />
      )}
      {loading && !data && <Loading />}
      {data?.length === 0 && <Muted>{t('progress.none')}</Muted>}
      {!!data?.length && <SpeakButton text={spoken} />}
      {data?.map((u) => (
        <Card key={u.id}>
          <Row>
            <StatusChip label={t(`trade.${u.trade}`)} tone="good" />
            <Muted>{showDate(u.taken_at)}</Muted>
          </Row>
          {u.photo_urls.map((url) => (
            <Pressable key={url} onPress={() => openUrl(url)}>
              <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: colors.border }} resizeMode="cover" />
            </Pressable>
          ))}
          {!!u.note && <Text style={{ fontSize: font.body, color: colors.text }}>{u.note}</Text>}
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            {u.milestone_name && <Muted>{u.milestone_name}</Muted>}
            <Muted>{t('progress.by', { name: u.posted_by_name })}</Muted>
          </View>
        </Card>
      ))}
    </>
  );
}
