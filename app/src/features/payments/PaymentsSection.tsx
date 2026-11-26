import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useApi } from '@/lib/useApi';
import type { Payment, Summary } from '@/lib/types';
import { BigButton, Title } from '@/ui/components';
import { PaymentList } from './PaymentList';
import { SummaryCard } from './SummaryCard';

/** Owner's money view for one project. */
export function PaymentsSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const summary = useApi<Summary>(`/projects/${projectId}/summary`);
  const payments = useApi<Payment[]>(`/projects/${projectId}/payments`);
  const reload = () => {
    void summary.reload();
    void payments.reload();
  };
  return (
    <>
      <Title>{t('payments.title')}</Title>
      {summary.data && <SummaryCard s={summary.data} showCash />}
      <BigButton
        label={t('payments.log')}
        icon="add-circle"
        onPress={() => router.push({ pathname: '/owner/payment', params: { projectId } })}
      />
      {payments.data && <PaymentList payments={payments.data} viewer="owner" onChanged={reload} />}
    </>
  );
}
