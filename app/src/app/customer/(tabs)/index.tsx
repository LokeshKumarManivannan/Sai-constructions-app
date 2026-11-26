import { Text } from '@/ui/Text';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useMyProject } from '@/features/customer/useMyProject';
import { ChangeOrderList } from '@/features/changeOrders/ChangeOrderList';
import { PaymentList } from '@/features/payments/PaymentList';
import { SummaryCard } from '@/features/payments/SummaryCard';
import { formatINR } from '@/lib/money';
import { openUrl } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Milestone, Payment, Summary } from '@/lib/types';
import { BigButton, Card, ErrorText, IconLabel, Loading, Muted, Screen, StatusChip, Title } from '@/ui/components';
import { milestoneTone, projectTone } from '@/ui/status';
import { colors, font, space } from '@/ui/theme';

// Money tab: Total / Paid / Balance, next payment, items to confirm, history, payment plan.
export default function CustomerMoney() {
  const { t } = useTranslation();
  const { project, error, loading } = useMyProject();
  const signed = !!project && project.status !== 'quote';
  const pid = project?.id;
  const summary = useApi<Summary>(signed ? `/projects/${pid}/summary` : null);
  const payments = useApi<Payment[]>(signed ? `/projects/${pid}/payments` : null);
  const milestones = useApi<Milestone[]>(signed ? `/projects/${pid}/milestones` : null);

  if (loading) return <Loading />;
  if (!project) return <Screen><ErrorText>{error}</ErrorText></Screen>;

  const reload = () => {
    void summary.reload();
    void payments.reload();
    void milestones.reload();
  };

  return (
    <Screen>
      {!signed && (
        <Card>
          <Muted>{t('customer.contractValue')}</Muted>
          <Text style={{ fontSize: font.big, fontWeight: '800' }}>{formatINR(project.contract_value_paise)}</Text>
          <Muted>{t('customer.planAfterAgreement')}</Muted>
        </Card>
      )}
      {summary.data && <SummaryCard s={summary.data} project={project} />}
      {signed && (
        <BigButton
          label={t('payments.logCustomer')}
          icon="add-circle"
          onPress={() => router.push({ pathname: '/customer/pay', params: { projectId: project.id } })}
        />
      )}
      {signed && <ChangeOrderList projectId={project.id} viewer="customer" onChanged={reload} />}
      {payments.data && <PaymentList payments={payments.data} viewer="customer" onChanged={reload} />}

      {signed && (
        <Card>
          <Title>{t('customer.paymentPlan')}</Title>
          {(milestones.data ?? []).map((m) => (
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
      )}

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
