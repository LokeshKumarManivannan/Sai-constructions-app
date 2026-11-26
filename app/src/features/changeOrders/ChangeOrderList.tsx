import { useTranslation } from 'react-i18next';

import { useApi } from '@/lib/useApi';
import type { ChangeOrder, Role } from '@/lib/types';
import { Muted, Title } from '@/ui/components';
import { ChangeOrderCard } from './ChangeOrderCard';

/** Extra work for a project; items waiting on the customer come first. */
export function ChangeOrderList({ projectId, viewer, onChanged }: { projectId: string; viewer: Role; onChanged?: () => void }) {
  const { t } = useTranslation();
  const { data, reload } = useApi<ChangeOrder[]>(`/projects/${projectId}/change-orders`);
  const changed = () => {
    void reload();
    onChanged?.();
  };
  const all = data ?? [];
  const waiting = all.filter((c) => c.status === 'sent');
  const rest = all.filter((c) => c.status !== 'sent');
  return (
    <>
      <Title>{t('extra.title')}</Title>
      {viewer === 'customer' && waiting.length > 0 && <Muted>{t('extra.decide')}</Muted>}
      {[...waiting, ...rest].map((c) => (
        <ChangeOrderCard key={c.id} co={c} viewer={viewer} onChanged={changed} />
      ))}
      {data && all.length === 0 && <Muted>{t('extra.none')}</Muted>}
    </>
  );
}
