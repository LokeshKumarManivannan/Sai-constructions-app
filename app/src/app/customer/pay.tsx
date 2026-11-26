import { router, useLocalSearchParams } from 'expo-router';

import { PaymentForm } from '@/features/payments/PaymentForm';
import { Screen } from '@/ui/components';

export default function CustomerPay() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return (
    <Screen>
      <PaymentForm projectId={projectId} role="customer" onSaved={() => router.replace('/customer')} />
    </Screen>
  );
}
