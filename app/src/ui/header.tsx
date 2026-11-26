import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HeaderActions } from './HeaderActions';
import { Text } from './Text';
import { colors, family } from './theme';

/** Blueprint header used by every stack. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.brand },
  headerTintColor: colors.brandText,
  headerTitleStyle: { fontFamily: family.bold, fontSize: 19, color: colors.brandText },
  headerShadowVisible: false,
  headerRight: () => <HeaderActions />,
  contentStyle: { backgroundColor: colors.bg },
};

/** Company mark: an amber roofline over the name. */
export function Wordmark({ size = 20, light = true }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: size * 1.6, height: size * 1.6, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="home" size={size} color={colors.brandDeep} />
      </View>
      <Text style={{ fontFamily: family.heavy, fontSize: size, color: light ? colors.brandText : colors.brand }}>Sai Constructions</Text>
    </View>
  );
}
