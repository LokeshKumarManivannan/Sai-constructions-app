import { useTranslation } from 'react-i18next';

import { Card, Muted, Screen, SpeakButton, Title } from '@/ui/components';

export default function CustomerProgress() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Card>
        <Title>{t('customer.progress')}</Title>
        <Muted>{t('customer.progressSoon')}</Muted>
        <SpeakButton text={t('customer.progressSoon')} />
      </Card>
    </Screen>
  );
}
