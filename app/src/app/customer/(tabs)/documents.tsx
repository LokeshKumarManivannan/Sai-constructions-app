import { useTranslation } from 'react-i18next';

import { useMyProject } from '@/features/customer/useMyProject';
import { DocumentList } from '@/features/documents/DocumentList';
import { HandoverSection } from '@/features/documents/HandoverSection';
import { Card, ErrorText, Loading, Muted, Screen, Title } from '@/ui/components';

export default function CustomerDocuments() {
  const { t } = useTranslation();
  const { project, error, loading } = useMyProject();
  if (loading) return <Loading />;
  if (!project) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  return (
    <Screen>
      <DocumentList projectId={project.id} viewer="customer" />
      <HandoverSection projectId={project.id} viewer="customer" />
      <Card>
        <Title>{t('warranty.title')}</Title>
        <Muted>{t('warranty.soon')}</Muted>
      </Card>
    </Screen>
  );
}
