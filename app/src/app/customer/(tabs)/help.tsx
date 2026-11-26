import { useTranslation } from 'react-i18next';

import { COMPANY_PHONE } from '@/config';
import { callNumber, whatsapp } from '@/lib/share';
import { BigButton, Screen } from '@/ui/components';

export default function CustomerHelp() {
  const { t } = useTranslation();
  return (
    <Screen>
      <BigButton label={t('customer.callUs')} icon="call" onPress={() => callNumber(COMPANY_PHONE)} />
      <BigButton label={t('customer.whatsappUs')} icon="logo-whatsapp" variant="secondary" onPress={() => whatsapp(COMPANY_PHONE)} />
    </Screen>
  );
}
