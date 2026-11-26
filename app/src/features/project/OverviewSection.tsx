import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@/lib/types';
import { BigButton, Card, ChipPicker, IconLabel, Muted, Title } from '@/ui/components';
import { colors, font } from '@/ui/theme';

export function OverviewSection({ project: p, onChanged }: { project: Project; onChanged: () => void }) {
  const { t } = useTranslation();

  async function setStatus(status: ProjectStatus) {
    await api(`/projects/${p.id}`, { method: 'PATCH', body: { status } });
    onChanged();
  }

  return (
    <Card>
      <Title>{p.name}</Title>
      <Text style={{ fontSize: font.body, color: colors.brand, fontWeight: '600' }} onPress={() => router.push(`/owner/customers/${p.customer_id}`)}>
        {p.customer_name}
      </Text>
      <Text style={{ fontSize: font.big, fontWeight: '800' }}>{formatINR(p.contract_value_paise)}</Text>
      <Muted>{t('owner.contractValue')}</Muted>
      <IconLabel icon="location">{p.site_address || '—'}</IconLabel>
      {(p.plot_size || p.floors) && (
        <IconLabel icon="business">{[p.plot_size, p.floors].filter(Boolean).join(' · ')}</IconLabel>
      )}
      {(p.start_date || p.target_end_date) && (
        <IconLabel icon="calendar">{`${p.start_date ?? '?'} → ${p.target_end_date ?? '?'}`}</IconLabel>
      )}
      {p.google_maps_url && (
        <BigButton label={t('common.openMap')} icon="map" variant="secondary" onPress={() => openUrl(p.google_maps_url!)} />
      )}
      <Muted>{t('owner.status')}</Muted>
      <ChipPicker options={PROJECT_STATUSES} value={p.status} onChange={setStatus} labelOf={(s) => t(`status.${s}`)} />
    </Card>
  );
}
