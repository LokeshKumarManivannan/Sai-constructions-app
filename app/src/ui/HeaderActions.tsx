import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { colors, space } from './theme';

/** Language toggle + logout, shown in every header (UX rule 1). */
export function HeaderActions() {
  const { t, i18n } = useTranslation();
  const { setLanguage, signOut, user } = useAuth();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, marginRight: space.s }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setLanguage(i18n.language === 'ta' ? 'en' : 'ta')}
        style={{ paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('common.language')}</Text>
      </Pressable>
      {user && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.logout')} onPress={signOut} hitSlop={10}>
          <Ionicons name="log-out-outline" size={26} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}
