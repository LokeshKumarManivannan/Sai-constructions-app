import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { Text } from './Text';
import { colors, space } from './theme';

/** Language toggle + logout, shown in every header (UX rule 1). */
export function HeaderActions() {
  const { t, i18n } = useTranslation();
  const { setLanguage, signOut, user } = useAuth();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, marginRight: space.m }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setLanguage(i18n.language === 'ta' ? 'en' : 'ta')}
        style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }}
      >
        <Text style={{ fontWeight: '600', color: colors.brandText, fontSize: 15 }}>{t('common.language')}</Text>
      </Pressable>
      {(user?.role === 'customer' || user?.role === 'owner') && <NotificationBell viewer={user.role} />}
      {user && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.logout')} onPress={signOut} hitSlop={10}>
          <Ionicons name="log-out-outline" size={25} color={colors.brandText} />
        </Pressable>
      )}
    </View>
  );
}
