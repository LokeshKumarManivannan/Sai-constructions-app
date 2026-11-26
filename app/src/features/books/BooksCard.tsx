import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatINR } from '@/lib/money';
import { useApi } from '@/lib/useApi';
import type { BooksSummary } from '@/lib/types';
import { BigButton, Card, Muted, Row, StatusChip } from '@/ui/components';
import { colors, font } from '@/ui/theme';

/** Owner home: cash in hand, untagged payments, and the money-out actions. */
export function BooksCard() {
  const { t } = useTranslation();
  const { data } = useApi<BooksSummary>('/books/summary');
  return (
    <Card>
      <Muted>{t('books.cashInHand')}</Muted>
      <Text style={{ fontSize: font.big, fontWeight: '800', color: (data?.cash_in_hand_paise ?? 0) < 0 ? colors.bad : colors.text }}>
        {formatINR(data?.cash_in_hand_paise ?? 0)}
      </Text>
      {data && data.untagged_count > 0 ? (
        <BigButton label={t('books.fixUntagged', { n: data.untagged_count })} icon="alert-circle" variant="danger" onPress={() => router.push('/owner/untagged')} />
      ) : (
        <StatusChip label={t('books.allFixed')} tone="good" />
      )}
      <BigButton label={t('books.paySomeone')} icon="arrow-up-circle" onPress={() => router.push('/owner/pay-out')} />
      <Row>
        <BigButton label={t('books.cashBook')} icon="wallet" variant="secondary" onPress={() => router.push('/owner/cashbook')} />
        <BigButton label={t('books.ledger')} icon="stats-chart" variant="secondary" onPress={() => router.push('/owner/books')} />
        <BigButton label={t('books.payees')} icon="people-circle" variant="secondary" onPress={() => router.push('/owner/payees')} />
      </Row>
    </Card>
  );
}
