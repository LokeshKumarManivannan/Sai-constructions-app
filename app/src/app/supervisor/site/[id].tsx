import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ProgressTimeline } from '@/features/progress/ProgressTimeline';
import { useApi } from '@/lib/useApi';
import type { ProjectSite } from '@/lib/types';
import { BigButton, ErrorText, Loading, Screen } from '@/ui/components';

export default function SupervisorSite() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: site, error } = useApi<ProjectSite>(`/projects/${id}`);
  if (!site) return error ? <ErrorText>{error}</ErrorText> : <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: site.name }} />
      <BigButton
        label={t('progress.add')}
        icon="camera"
        onPress={() => router.push({ pathname: '/supervisor/update', params: { projectId: site.id } })}
      />
      <ProgressTimeline projectId={site.id} trades={site.my_trades} />
    </Screen>
  );
}
