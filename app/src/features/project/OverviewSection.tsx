import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { showDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@/lib/types';
import { BuildingProgress } from '@/ui/BuildingProgress';
import { SiteCodeCard } from './SiteCodeCard';
import { BigButton, Card, ChipPicker, HeroCard, IconLabel, Muted } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font, space } from '@/ui/theme';

export function OverviewSection({ project: p, onChanged }: { project: Project; onChanged: () => void }) {
  const { t } = useTranslation();

  async function setStatus(status: ProjectStatus) {
    await api(`/projects/${p.id}`, { method: 'PATCH', body: { status } });
    onChanged();
  }

  return (
    <>
      <HeroCard>
        <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.brandText, fontSize: font.hero, fontWeight: '800' }}>{p.name}</Text>
            <Pressable onPress={() => router.push(`/owner/customers/${p.customer_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="person" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: font.body, fontWeight: '600' }}>{p.customer_name}</Text>
            </Pressable>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.small, marginTop: space.m }}>{t('owner.contractValue')}</Text>
            <Text style={{ color: colors.brandText, fontSize: font.big, fontWeight: '800' }}>{formatINR(p.contract_value_paise)}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <BuildingProgress total={p.milestones_total} done={p.milestones_done} size="large" onDark />
            {p.milestones_total > 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                {t('owner.stagesDone', { done: p.milestones_done, total: p.milestones_total })}
              </Text>
            )}
          </View>
        </View>
      </HeroCard>

      <Card>
        <IconLabel icon="location">{p.site_address || '—'}</IconLabel>
        {(p.plot_size || p.floors) && <IconLabel icon="business">{[p.plot_size, p.floors].filter(Boolean).join(', ')}</IconLabel>}
        {(p.start_date || p.target_end_date) && (
          <IconLabel icon="calendar">{`${showDate(p.start_date) || '?'} – ${showDate(p.target_end_date) || '?'}`}</IconLabel>
        )}
        {p.google_maps_url && (
          <BigButton label={t('common.openMap')} icon="map" variant="secondary" onPress={() => openUrl(p.google_maps_url!)} />
        )}
        <Muted>{t('owner.status')}</Muted>
        <ChipPicker options={PROJECT_STATUSES} value={p.status} onChange={setStatus} labelOf={(s) => t(`status.${s}`)} />
      </Card>
      <SiteCodeCard project={p} onChanged={onChanged} />
    </>
  );
}
