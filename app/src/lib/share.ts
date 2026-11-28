import { Linking, Platform, Share } from 'react-native';

/** Web: copy to clipboard. Phone: open the share sheet (WhatsApp, SMS…). Returns true if copied. */
export async function shareText(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    await globalThis.navigator?.clipboard?.writeText(text);
    return true;
  }
  await Share.share({ message: text });
  return false;
}

export function openUrl(url: string) {
  void Linking.openURL(url);
}

export function callNumber(phone: string) {
  openUrl(`tel:${phone}`);
}

/** Open the phone's own Messages app with the number and text filled in; the owner presses Send.
 *  Uses his normal SMS plan, so no SMS service or WhatsApp Business account is needed. */
export function textMessage(phone: string, body: string) {
  // "?&body=" works on both Android ("?body=") and iPhone ("&body=").
  const url = `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`;
  // In a phone browser, open it in place: a new window after a network call can be blocked as a pop-up.
  if (Platform.OS === 'web') globalThis.location.href = url;
  else openUrl(url);
}

/** A phone (app, or a browser on a phone) can open the Messages app; a computer can't. */
export function canTextFromHere(): boolean {
  if (Platform.OS !== 'web') return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(globalThis.navigator?.userAgent ?? '');
}

export function whatsapp(phone: string) {
  openUrl(`https://wa.me/${phone.replace(/\D/g, '')}`);
}
