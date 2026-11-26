import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PaymentForm } from '@/features/payments/PaymentForm';
import { useApi } from '@/lib/useApi';
import type { Project } from '@/lib/types';
import { Card, ChipPicker, Muted, Screen } from '@/ui/components';

/** Owner: record money received from a customer. Pick the project, then the usual payment form. */
export default function MoneyIn() {
  const { t } = useTranslation();
  const { data } = useApi<Project[]>('/projects');
  const ps = (data ?? []).filter((p) => p.status !== 'quote');
  const [projectId, setProjectId] = useState<string | null>(null);

  return (
    <Screen>
      <Card>
        <Muted>{t('books.moneyInFor')}</Muted>
        <ChipPicker options={ps.map((p) => p.id)} value={projectId} onChange={setProjectId} labelOf={(id) => ps.find((p) => p.id === id)?.name ?? ''} />
      </Card>
      {projectId && <PaymentForm key={projectId} projectId={projectId} role="owner" onSaved={() => router.back()} />}
    </Screen>
  );
}
