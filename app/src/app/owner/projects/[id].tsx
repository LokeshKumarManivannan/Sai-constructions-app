import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ProjectExpenses } from '@/features/books/ProjectExpenses';
import { DocumentList } from '@/features/documents/DocumentList';
import { HandoverSection } from '@/features/documents/HandoverSection';
import { ChangeOrderList } from '@/features/changeOrders/ChangeOrderList';
import { PaymentsSection } from '@/features/payments/PaymentsSection';
import { ProgressTimeline } from '@/features/progress/ProgressTimeline';
import { InviteSection } from '@/features/project/InviteSection';
import { MilestonesSection } from '@/features/project/MilestonesSection';
import { OverviewSection } from '@/features/project/OverviewSection';
import { TeamSection } from '@/features/project/TeamSection';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { BigButton, ChipPicker, ErrorText, Loading, Screen } from '@/ui/components';

const TABS = ['overview', 'money', 'extra', 'progress', 'expenses', 'milestones', 'documents', 'handover', 'team'] as const;
type Tab = (typeof TABS)[number];

export default function OwnerProject() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: project, error, reload } = useApi<Project>(`/projects/${id}`);
  const [tab, setTab] = useState<Tab>('overview');

  if (!project) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  const label: Record<Tab, string> = {
    overview: t('owner.overview'),
    money: t('payments.title'),
    extra: t('extra.title'),
    progress: t('progress.title'),
    expenses: t('books.expenses'),
    milestones: t('owner.milestones'),
    documents: t('docs.title'),
    handover: t('handover.title'),
    team: t('owner.team'),
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: project.name }} />
      <ChipPicker options={[...TABS]} value={tab} onChange={setTab} labelOf={(k) => label[k]} scroll />
      {tab === 'overview' && (
        <>
          <OverviewSection project={project} onChanged={reload} />
          <InviteSection projectId={project.id} />
        </>
      )}
      {tab === 'money' && <PaymentsSection projectId={project.id} />}
      {tab === 'extra' && (
        <>
          <BigButton
            label={t('extra.add')}
            icon="add-circle"
            onPress={() => router.push({ pathname: '/owner/extra', params: { projectId: project.id } })}
          />
          <ChangeOrderList projectId={project.id} viewer="owner" />
        </>
      )}
      {tab === 'progress' && (
        <>
          <BigButton
            label={t('progress.add')}
            icon="camera"
            onPress={() => router.push({ pathname: '/owner/update', params: { projectId: project.id } })}
          />
          <ProgressTimeline projectId={project.id} />
        </>
      )}
      {tab === 'expenses' && <ProjectExpenses projectId={project.id} />}
      {tab === 'milestones' && <MilestonesSection project={project} />}
      {tab === 'documents' && (
        <>
          <BigButton
            label={t('docs.upload')}
            icon="cloud-upload"
            onPress={() => router.push({ pathname: '/owner/document', params: { projectId: project.id } })}
          />
          <DocumentList projectId={project.id} viewer="owner" />
        </>
      )}
      {tab === 'handover' && <HandoverSection projectId={project.id} viewer="owner" />}
      {tab === 'team' && <TeamSection projectId={project.id} />}
    </Screen>
  );
}
