import { Stack, useLocalSearchParams } from 'expo-router';

import { InviteSection } from '@/features/project/InviteSection';
import { MilestonesSection } from '@/features/project/MilestonesSection';
import { OverviewSection } from '@/features/project/OverviewSection';
import { TeamSection } from '@/features/project/TeamSection';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { ErrorText, Loading, Screen } from '@/ui/components';

export default function OwnerProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: project, error, reload } = useApi<Project>(`/projects/${id}`);

  if (!project) return error ? <ErrorText>{error}</ErrorText> : <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: project.name }} />
      <OverviewSection project={project} onChanged={reload} />
      <MilestonesSection project={project} />
      <TeamSection projectId={project.id} />
      <InviteSection projectId={project.id} />
    </Screen>
  );
}
