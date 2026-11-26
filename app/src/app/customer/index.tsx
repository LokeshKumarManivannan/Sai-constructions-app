import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMyProject } from '@/features/customer/useMyProject';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Milestone } from '@/lib/types';
import { BigButton, Card, ErrorText, IconLabel, Loading, Muted, Screen, SpeakButton, StatusChip, Title } from '@/ui/components';
import { milestoneTone, projectTone } from '@/ui/status';
import { colors, font, space } from '@/ui/theme';

// Money tab. Phase 1: contract value + payment plan. Paid / outstanding arrive with payments (phase 2).
export default function CustomerMoney() {
  const { t } = useTranslation();
  const { project, error, loading } = useMyProject();
  const milestones = useApi<Milestone[]>(project ? `/projects/${project.id}/milestones` : null);

  if (loading) return <Loading />;
  if (!project) return <Screen><ErrorText>{error}</ErrorText></Screen>;

  const plan = milestones.data ?? [];
  const spoken = [
    `${t('customer.contractValue')}: ${formatINR(project.contract_value_paise)}`,
    ...plan.map((m) => `${m.name}: ${formatINR(m.amount_due_paise)}, ${t(`status.${m.status}`)}`),
  ].join('. ');

  return (
    <Screen>
      <Card>
        <Muted>{t('customer.contractValue')}</Muted>
        <Text style={{ fontSize: font.big, fontWeight: '800', color: colors.text }}>
          {formatINR(project.contract_value_paise)}
        </Text>
        <SpeakButton text={spoken} />
      </Card>

      <Card>
        <Title>{t('customer.paymentPlan')}</Title>
        {plan.length === 0 && <Muted>{t('customer.planAfterAgreement')}</Muted>}
        {plan.map((m) => (
          <View key={m.id} style={{ gap: space.xs, paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s }}>
              <Text style={{ fontSize: font.body, fontWeight: '600', flexShrink: 1 }}>
                {m.seq}. {m.name}
              </Text>
              <Text style={{ fontSize: font.body + 2, fontWeight: '800' }}>{formatINR(m.amount_due_paise)}</Text>
            </View>
            <StatusChip label={t(`status.${m.status}`)} tone={milestoneTone[m.status]} />
          </View>
        ))}
      </Card>

      <Card>
        <Title>{t('customer.project')}</Title>
        <Text style={{ fontSize: font.body, fontWeight: '700' }}>{project.name}</Text>
        <StatusChip label={t(`status.${project.status}`)} tone={projectTone[project.status]} />
        <IconLabel icon="location">{project.site_address || '—'}</IconLabel>
        {project.floors && <IconLabel icon="business">{project.floors}</IconLabel>}
        {project.target_end_date && <IconLabel icon="flag">{project.target_end_date}</IconLabel>}
        {project.google_maps_url && (
          <BigButton label={t('common.openMap')} icon="map" variant="secondary" onPress={() => openUrl(project.google_maps_url!)} />
        )}
      </Card>
    </Screen>
  );
}
