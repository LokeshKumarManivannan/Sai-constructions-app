import { router, useLocalSearchParams } from 'expo-router';

import { AddUpdateForm } from '@/features/progress/AddUpdateForm';
import { useApi } from '@/lib/useApi';
import type { ProjectSite } from '@/lib/types';
import { Loading, Screen } from '@/ui/components';

export default function SupervisorAddUpdate() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data: site } = useApi<ProjectSite>(`/projects/${projectId}`);
  if (!site) return <Loading />;
  return (
    <Screen>
      <AddUpdateForm projectId={site.id} trades={site.my_trades} role="supervisor" onSaved={() => router.back()} />
    </Screen>
  );
}
