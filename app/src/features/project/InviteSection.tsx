import { useState } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/lib/api';
import { shareText, textMessage } from '@/lib/share';
import { useApi } from '@/lib/useApi';
import type { Invite } from '@/lib/types';
import { BigButton, Card, ErrorText, Muted, StatusChip, Title } from '@/ui/components';
import { Text } from '@/ui/Text';
import { colors, font } from '@/ui/theme';

export function InviteSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const invites = useApi<Invite[]>(`/projects/${projectId}/invites`);
  const [latest, setLatest] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setCopied(false);
    try {
      const inv = await api<Invite>(`/projects/${projectId}/invites`, { method: 'POST', body: {} });
      setLatest(inv);
      await invites.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const message = (link: string) => t('owner.inviteSms', { link });

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
          <BigButton label={t('owner.sendSms')} icon="chatbubble-ellipses" onPress={() => textMessage(latest.phone, message(latest.link))} />
          {Platform.OS === 'web' && <Muted>{t('owner.smsFromPhone')}</Muted>}
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
