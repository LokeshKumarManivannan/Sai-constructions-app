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

export function whatsapp(phone: string) {
  openUrl(`https://wa.me/${phone.replace(/\D/g, '')}`);
}
