import { router, useLocalSearchParams } from 'expo-router';

import { PaymentForm } from '@/features/payments/PaymentForm';
import { Screen } from '@/ui/components';

export default function OwnerRecordPayment() {
  const { projectId, correctsId } = useLocalSearchParams<{ projectId: string; correctsId?: string }>();
  return (
    <Screen>
      <PaymentForm projectId={projectId} role="owner" correctsId={correctsId} onSaved={() => router.back()} />
    </Screen>
  );
}
