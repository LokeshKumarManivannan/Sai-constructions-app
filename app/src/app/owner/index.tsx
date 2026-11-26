import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BooksCard } from '@/features/books/BooksCard';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, IconLabel, Loading, Muted, Row, Screen, StatusChip, Title } from '@/ui/components';
import { projectTone } from '@/ui/status';
import { font } from '@/ui/theme';

// Owner home: money at a glance, then every project.
export default function OwnerHome() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { data, error, loading } = useApi<Project[]>('/projects');
  const needle = q.trim().toLowerCase();
  const projects = (data ?? []).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.customer_name.toLowerCase().includes(needle),
  );

  return (
    <Screen>
      <BooksCard />
      <BigButton label={t('owner.newProject')} icon="add-circle" onPress={() => router.push('/owner/projects/new')} />
      <Row>
        <BigButton label={t('owner.customers')} icon="person" variant="secondary" onPress={() => router.push('/owner/customers')} />
        <BigButton label={t('owner.supervisors')} icon="people" variant="secondary" onPress={() => router.push('/owner/supervisors')} />
      </Row>
      <Title>{t('owner.projects')}</Title>
      <Field label={t('owner.searchProjects')} value={q} onChangeText={setQ} />
      <ErrorText>{error}</ErrorText>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Muted>{t('owner.noProjects')}</Muted>}
      {projects.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/owner/projects/${p.id}`)}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>{p.name}</Text>
          <StatusChip label={t(`status.${p.status}`)} tone={projectTone[p.status]} />
          <IconLabel icon="person">{p.customer_name}</IconLabel>
          {!!p.site_address && <IconLabel icon="location">{p.site_address}</IconLabel>}
        </Card>
      ))}
    </Screen>
  );
}
