import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { ProjectSite } from '@/lib/types';
import { BigButton, Card, ErrorText, IconLabel, Loading, Muted, Row, Screen, SpeakButton, StatusChip, Title } from '@/ui/components';

export default function MySites() {
  const { t } = useTranslation();
  const { data, error, loading } = useApi<ProjectSite[]>('/projects');

  const spoken = (data ?? []).map((s) => `${s.name}. ${s.my_trades.map((tr) => t(`trade.${tr}`)).join(', ')}`).join('. ');

  return (
    <Screen>
      <BigButton label={t('mymoney.title')} icon="wallet" variant="secondary" onPress={() => router.push('/supervisor/money')} />
      <ErrorText>{error}</ErrorText>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Muted>{t('supervisor.noSites')}</Muted>}
      {!!data?.length && <SpeakButton text={`${t('supervisor.mySites')}. ${spoken}`} />}
      {data?.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/supervisor/site/${s.id}`)}>
          <Title>{s.name}</Title>
          <Row>
            {s.my_trades.map((tr) => (
              <StatusChip key={tr} label={t(`trade.${tr}`)} tone="good" />
            ))}
          </Row>
          <IconLabel icon="location">{s.site_address || '—'}</IconLabel>
          {s.google_maps_url && (
            <BigButton label={t('common.openMap')} icon="map" variant="secondary" onPress={() => openUrl(s.google_maps_url!)} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
