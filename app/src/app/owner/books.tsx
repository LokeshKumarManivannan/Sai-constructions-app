import { Text } from '@/ui/Text';
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExpenseCard } from '@/features/books/ExpenseCard';
import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import { EXPENSE_CATEGORIES, type BooksSummary, type Expense, type ExpenseCategory } from '@/lib/types';
import { Card, ChipPicker, Muted, Screen, Title } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

export default function Books() {
  const { t } = useTranslation();
  const summary = useApi<BooksSummary>('/books/summary');
  const [projectId, setProjectId] = useState<string>('all');
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const qs = new URLSearchParams();
  if (projectId !== 'all') qs.set('project_id', projectId);
  if (category !== 'all') qs.set('category', category);
  qs.set('include_void', 'true');
  const expenses = useApi<Expense[]>(`/expenses?${qs.toString()}`);
  const sites = summary.data?.sites ?? [];

  return (
    <Screen>
      <Card>
        <Title>{t('books.ledger')}</Title>
        {sites.map((s) => (
          <View key={s.project_id} style={{ paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.border, gap: 2 }}>
            <Text style={{ fontSize: font.body, fontWeight: '700' }} onPress={() => router.push(`/owner/projects/${s.project_id}`)}>
              {s.project_name}
            </Text>
            <Muted>{`${t('books.received')} ${formatINR(s.received_paise)} · ${t('books.spent')} ${formatINR(s.spent_paise)}`}</Muted>
            <Text style={{ fontSize: font.body, fontWeight: '800', color: s.net_paise < 0 ? colors.bad : colors.good }}>
              {t('books.net')} {formatINR(s.net_paise)}
            </Text>
          </View>
        ))}
      </Card>
      <Title>{t('books.allPayments')}</Title>
      <ChipPicker
        options={['all', ...sites.map((s) => s.project_id)]}
        value={projectId}
        onChange={setProjectId}
        labelOf={(id) => (id === 'all' ? t('progress.all') : sites.find((s) => s.project_id === id)?.project_name ?? '')}
      />
      <ChipPicker
        options={['all', ...EXPENSE_CATEGORIES] as (ExpenseCategory | 'all')[]}
        value={category}
        onChange={setCategory}
        labelOf={(c) => (c === 'all' ? t('progress.all') : t(`ecat.${c}`))}
      />
      {expenses.data?.length === 0 && <Muted>{t('books.noEntries')}</Muted>}
      {expenses.data?.map((e) => (
        <ExpenseCard
          key={e.id}
          e={e}
          onChanged={() => {
            void expenses.reload();
            void summary.reload();
          }}
        />
      ))}
    </Screen>
  );
}
