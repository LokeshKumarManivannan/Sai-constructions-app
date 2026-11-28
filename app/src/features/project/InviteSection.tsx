import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { shareText, textMessage } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Invite } from '@/lib/types';
import { BigButton, Card, ErrorText, Muted, StatusChip, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font } from '@/ui/theme';
import { inviteAndText, inviteMessage } from './sendInvite';

export function InviteSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const invites = useApi<Invite[]>(`/projects/${projectId}/invites`);
  const [latest, setLatest] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [how, setHow] = useState<'sms' | 'copied' | null>(null);

  async function create() {
    setError(null);
    setCopied(false);
    try {
      const r = await inviteAndText(projectId, t);
      setLatest(r.invite);
      setHow(r.how);
      await invites.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const message = (link: string) => inviteMessage(t, link);

  async function copy(link: string) {
    setCopied(await shareText(message(link)));
  }

  return (
    <Card>
      <Title>{t('owner.inviteCustomer')}</Title>
      <Muted>{t('owner.inviteHint')}</Muted>
      <BigButton label={t('owner.inviteCustomer')} icon="send" onPress={create} />
      <ErrorText>{error}</ErrorText>
      {latest && (
        <>
          <Text selectable style={{ fontSize: font.small, color: colors.text }}>
            {latest.link}
          </Text>
          <Muted>{how === 'sms' ? t('owner.smsOpened') : t('owner.smsCopied')}</Muted>
          <BigButton label={t('owner.sendSmsAgain')} icon="chatbubble-ellipses" variant="secondary" onPress={() => textMessage(latest.phone, message(latest.link))} />
          <BigButton
            label={copied ? t('common.copied') : t('common.copy')}
            icon={copied ? 'checkmark' : 'copy'}
            variant="secondary"
            onPress={() => copy(latest.link)}
          />
        </>
      )}
      {(invites.data ?? []).map((i) => (
        <StatusChip
          key={i.id}
          label={`${i.phone} · ${i.status}`}
          tone={i.status === 'accepted' ? 'good' : i.status === 'sent' ? 'warn' : 'neutral'}
        />
      ))}
    </Card>
  );
}
