import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PaymentForm } from '@/features/payments/PaymentForm';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { Card, ChipPicker, Muted, Screen } from '@/ui/components';

/** Money received from a customer. Opened from a project (projectId given) or from home (pick the project first). */
export default function OwnerRecordPayment() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ projectId?: string; correctsId?: string }>();
  const [picked, setPicked] = useState<string | null>(null);
  const projects = useApi<Project[]>(params.projectId ? null : '/projects');
  const projectId = params.projectId ?? picked;
  const ps = projects.data ?? [];

  return (
    <Screen>
      {!params.projectId && (
        <Card>
          <Muted>{t('books.pickProjectIn')}</Muted>
          <ChipPicker options={ps.map((p) => p.id)} value={picked} onChange={setPicked} labelOf={(id) => ps.find((p) => p.id === id)?.name ?? ''} />
        </Card>
      )}
      {projectId && (
        <PaymentForm key={projectId} projectId={projectId} role="owner" correctsId={params.correctsId} onSaved={() => router.back()} />
      )}
    </Screen>
  );
}
