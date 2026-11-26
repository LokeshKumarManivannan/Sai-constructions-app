import { useTranslation } from 'react-i18next';

import { Card, Muted, Screen, SpeakButton, Title } from '@/ui/components';

export default function CustomerDocuments() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Card>
        <Title>{t('customer.documents')}</Title>
        <Muted>{t('customer.documentsSoon')}</Muted>
        <SpeakButton text={t('customer.documentsSoon')} />
      </Card>
    </Screen>
  );
}
