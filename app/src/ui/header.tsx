import { useWindowDimensions, View } from 'react-native';

import { HeaderActions } from './HeaderActions';
import { Logo } from './Logo';
import { Text } from './Text';
import { colors, family } from './theme';

/** Laterite header used by every stack. */
export const headerOptions = {
  headerStyle: { backgroundColor: colors.brand },
  headerTintColor: colors.brandText,
  headerTitleStyle: { fontFamily: family.bold, fontSize: 19, color: colors.brandText },
  headerShadowVisible: false,
  headerRight: () => <HeaderActions />,
  contentStyle: { backgroundColor: colors.bg },
};

/** Company mark: the arch on a cement tile, then the name. */
export function Wordmark({ size = 20, light = true }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: size * 2, height: size * 2, borderRadius: 10, backgroundColor: '#F2F0ED', alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={size * 1.7} />
      </View>
      <Text style={{ fontFamily: family.heavy, fontSize: size, color: light ? colors.brandText : colors.brand }}>Sai Constructions</Text>
    </View>
  );
}

/** Small mark for header titles. */
export function HeaderTitle({ title }: { title: string }) {
  // Leave room for the language, bell and logout buttons on the right (and the menu on the left).
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: Math.max(140, width - 220) }}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#F2F0ED', alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={26} />
      </View>
      <Text style={{ fontFamily: family.bold, fontSize: 18, color: colors.brandText, flexShrink: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}
