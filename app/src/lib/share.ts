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
  openUrl(`sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`);
}

export function whatsapp(phone: string) {
  openUrl(`https://wa.me/${phone.replace(/\D/g, '')}`);
}
