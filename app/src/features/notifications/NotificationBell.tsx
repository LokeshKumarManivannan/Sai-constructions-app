import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';
import { useNotifications } from './useNotifications';

/** Header bell with a count of unread notifications. */
export function NotificationBell({ viewer }: { viewer: 'customer' | 'owner' }) {
  const { t } = useTranslation();
  const { unread } = useNotifications();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('notify.title')} onPress={() => router.push(`/${viewer}/notifications`)} hitSlop={10}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={25} color={colors.brandText} />
      {unread > 0 && (
        <View
          style={{ position: 'absolute', top: -6, right: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, lineHeight: 16 }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
