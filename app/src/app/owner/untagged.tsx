import { useTranslation } from 'react-i18next';

import { ExpenseCard } from '@/features/books/ExpenseCard';
import { useApi } from '@/lib/useApi';
import type { Expense } from '@/lib/types';
import { Loading, Muted, Screen, StatusChip } from '@/ui/components';

export default function Untagged() {
  const { t } = useTranslation();
  const { data, loading, reload } = useApi<Expense[]>('/expenses?untagged=true');
  return (
    <Screen>
      {loading && !data && <Loading />}
      {data?.length === 0 && <StatusChip label={t('books.allFixed')} tone="good" />}
      {!!data?.length && <Muted>{t('books.untagged')}</Muted>}
      {data?.map((e) => (
        <ExpenseCard key={e.id} e={e} onChanged={reload} startOpen />
      ))}
    </Screen>
  );
}
