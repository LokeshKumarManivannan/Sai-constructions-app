import type { TFunction } from 'i18next';

import { api } from '@/lib/api';
import { canTextFromHere, shareText, textMessage } from '@/lib/share';
import type { Invite } from '@/lib/types';

export const inviteMessage = (t: TFunction, link: string) => t('owner.inviteSms', { link });

/** Create the customer's invite and hand it to the Messages app in one go: on a phone the text opens
 *  ready with the number filled in (the owner presses Send); on a computer it is copied instead. */
export async function inviteAndText(projectId: string, t: TFunction): Promise<{ invite: Invite; how: 'sms' | 'copied' }> {
  const invite = await api<Invite>(`/projects/${projectId}/invites`, { method: 'POST', body: {} });
  if (canTextFromHere()) {
    textMessage(invite.phone, inviteMessage(t, invite.link));
    return { invite, how: 'sms' };
  }
  await shareText(inviteMessage(t, invite.link));
  return { invite, how: 'copied' };
}
