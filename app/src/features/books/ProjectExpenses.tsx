import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { Expense } from '@/lib/types';
import { Card, Muted } from '@/ui/components';
import { font } from '@/ui/theme';
import { ExpenseCard } from './ExpenseCard';

export function ProjectExpenses({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, reload } = useApi<Expense[]>(`/expenses?project_id=${projectId}`);
  const spent = (data ?? []).filter((e) => e.category !== 'advance').reduce((s, e) => s + e.amount_paise, 0);
  return (
    <>
      <Card>
        <Muted>{t('books.spentHere')}</Muted>
        <Text style={{ fontSize: font.big, fontWeight: '800' }}>{formatINR(spent)}</Text>
      </Card>
      {data?.length === 0 && <Muted>{t('books.noEntries')}</Muted>}
      {data?.map((e) => (
        <ExpenseCard key={e.id} e={e} onChanged={reload} />
      ))}
    </>
  );
}
