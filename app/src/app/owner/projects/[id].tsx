import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChangeOrderList } from '@/features/changeOrders/ChangeOrderList';
import { PaymentsSection } from '@/features/payments/PaymentsSection';
import { InviteSection } from '@/features/project/InviteSection';
import { MilestonesSection } from '@/features/project/MilestonesSection';
import { OverviewSection } from '@/features/project/OverviewSection';
import { TeamSection } from '@/features/project/TeamSection';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { BigButton, ChipPicker, ErrorText, Loading, Screen } from '@/ui/components';

const TABS = ['overview', 'money', 'extra', 'milestones', 'team'] as const;
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
    milestones: t('owner.milestones'),
    team: t('owner.team'),
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: project.name }} />
      <ChipPicker options={[...TABS]} value={tab} onChange={setTab} labelOf={(k) => label[k]} />
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
      {tab === 'milestones' && <MilestonesSection project={project} />}
      {tab === 'team' && <TeamSection projectId={project.id} />}
    </Screen>
  );
}
