import { useTranslation } from 'react-i18next';

import { useMyProject } from '@/features/customer/useMyProject';
import { ProgressMeter } from '@/features/customer/StageTracker';
import { ProgressTimeline } from '@/features/progress/ProgressTimeline';
import { ErrorText, Loading, Muted, Screen } from '@/ui/components';

export default function CustomerProgress() {
  const { t } = useTranslation();
  const { project, error, loading } = useMyProject();
  if (loading) return <Loading />;
  if (!project) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  return (
    <Screen>
      {project.status === 'quote' ? <Muted>{t('customer.progressSoon')}</Muted> : (
        <>
          <ProgressMeter project={project} />
          <ProgressTimeline projectId={project.id} />
        </>
      )}
    </Screen>
  );
}
