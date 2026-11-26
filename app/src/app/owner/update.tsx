import { router, useLocalSearchParams } from 'expo-router';

import { AddUpdateForm } from '@/features/progress/AddUpdateForm';
import { TRADES } from '@/lib/types';
import { Screen } from '@/ui/components';

export default function OwnerAddUpdate() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return (
    <Screen>
      <AddUpdateForm projectId={projectId} trades={TRADES} role="owner" onSaved={() => router.back()} />
    </Screen>
  );
}
