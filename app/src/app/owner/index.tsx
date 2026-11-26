import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BooksCard } from '@/features/books/BooksCard';
import { ProjectCard } from '@/features/project/ProjectCard';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { BigButton, Empty, ErrorText, Field, Loading, Row, Screen, SectionTitle } from '@/ui/components';

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
      <SectionTitle icon="business">{t('owner.projects')}</SectionTitle>
      <BigButton label={t('owner.newProject')} icon="add-circle" onPress={() => router.push('/owner/projects/new')} />
      {(data?.length ?? 0) > 3 && <Field label={t('owner.searchProjects')} value={q} onChangeText={setQ} />}
      <ErrorText>{error}</ErrorText>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty icon="construct">{t('owner.noProjectsYet')}</Empty>}
      {projects.map((p) => (
        <ProjectCard key={p.id} p={p} />
      ))}
      <Row>
        <BigButton label={t('owner.customers')} icon="person" variant="secondary" onPress={() => router.push('/owner/customers')} />
        <BigButton label={t('owner.supervisors')} icon="people" variant="secondary" onPress={() => router.push('/owner/supervisors')} />
      </Row>
    </Screen>
  );
}
