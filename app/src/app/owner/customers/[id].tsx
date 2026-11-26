import { Text } from '@/ui/Text';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { callNumber } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Customer, Project } from '@/lib/types';
import { BigButton, Card, ErrorText, IconLabel, Loading, Muted, Row, Screen, StatusChip, Title } from '@/ui/components';
import { projectTone } from '@/ui/status';
import { font } from '@/ui/theme';

export default function CustomerDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useApi<Customer>(`/customers/${id}`);
  const projects = useApi<Project[]>(`/projects?customer_id=${id}`);
  const c = customer.data;

  if (!c) return customer.error ? <ErrorText>{customer.error}</ErrorText> : <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: c.name }} />
      <Card>
        <Title>{c.name}</Title>
        <IconLabel icon="call">{c.phone}</IconLabel>
        {c.alt_phone && <IconLabel icon="call-outline">{c.alt_phone}</IconLabel>}
        {c.address && <IconLabel icon="location">{c.address}</IconLabel>}
        {c.notes && <Muted>{c.notes}</Muted>}
        <BigButton label={t('common.call')} icon="call" variant="secondary" onPress={() => callNumber(c.phone)} />
      </Card>

      <Row>
        <Title>{t('owner.projects')}</Title>
      </Row>
      <BigButton
        label={t('owner.newProject')}
        icon="add-circle"
        onPress={() => router.push({ pathname: '/owner/projects/new', params: { customerId: c.id } })}
      />
      {projects.data?.length === 0 && <Muted>{t('owner.noProjects')}</Muted>}
      {projects.data?.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/owner/projects/${p.id}`)}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>{p.name}</Text>
          <StatusChip label={t(`status.${p.status}`)} tone={projectTone[p.status]} />
          <IconLabel icon="location">{p.site_address}</IconLabel>
          <IconLabel icon="cash">{formatINR(p.contract_value_paise)}</IconLabel>
        </Card>
      ))}
    </Screen>
  );
}
