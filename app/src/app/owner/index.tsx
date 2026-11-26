import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BooksCard } from '@/features/books/BooksCard';
import { useApi } from '@/lib/useApi';
import type { Customer } from '@/lib/types';
import { BigButton, Card, ErrorText, Field, IconLabel, Loading, Muted, Row, Screen } from '@/ui/components';
import { font } from '@/ui/theme';

export default function OwnerHome() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { data, error, loading } = useApi<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  return (
    <Screen>
      <BooksCard />
      <Row>
        <BigButton label={t('owner.newCustomer')} icon="person-add" onPress={() => router.push('/owner/customers/new')} />
        <BigButton
          label={t('owner.supervisors')}
          icon="people"
          variant="secondary"
          onPress={() => router.push('/owner/supervisors')}
        />
      </Row>
      <Field label={t('owner.searchCustomers')} value={q} onChangeText={setQ} />
      <ErrorText>{error}</ErrorText>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Muted>{t('owner.noCustomers')}</Muted>}
      {data?.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/owner/customers/${c.id}`)}>
          <Text style={{ fontSize: font.body, fontWeight: '700' }}>{c.name}</Text>
          <IconLabel icon="call">{c.phone}</IconLabel>
          <IconLabel icon="home">{`${t('owner.projects')}: ${c.project_count}`}</IconLabel>
        </Card>
      ))}
    </Screen>
  );
}
