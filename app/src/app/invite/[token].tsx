import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useApi } from '@/lib/useApi';
import type { PublicInvite } from '@/lib/types';
import { BigButton, Card, ErrorText, Loading, Muted, Screen, SpeakButton, Title } from '@/ui/components';

export default function InviteLanding() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, error, loading } = useApi<PublicInvite>(`/public/invites/${token}`);

  if (loading && !data) return <Loading />;

  if (error || !data?.usable) {
    return (
      <Screen>
        <ErrorText>{t('invite.invalid')}</ErrorText>
      </Screen>
    );
  }

  const lastDigits = data.phone_masked.slice(-4);
  return (
    <Screen>
      <Title>{t('invite.title')}</Title>
      <Card>
        <Muted>{t('invite.body')}</Muted>
        <Title>{data.project_name}</Title>
        <Muted>
          {t('invite.phoneHint')} {lastDigits}
        </Muted>
      </Card>
      <SpeakButton text={`${t('invite.body')} ${data.project_name}`} />
      <BigButton label={t('invite.continue')} icon="arrow-forward" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
