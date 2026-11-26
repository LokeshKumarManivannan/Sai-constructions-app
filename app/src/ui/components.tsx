import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { colors, family, font, minTouch, radius, space } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.screenBody}>{children}</ScrollView> : children}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

/** Section heading with a small icon tile: tells low-literacy readers what the block is about. */
export function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={styles.title}>{children}</Text>
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The one dark blueprint panel per screen: the thing a person should look at first. */
export function HeroCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.hero}>
      <BrickPattern />
      <View style={{ gap: space.s }}>{children}</View>
    </View>
  );
}

/** Faint brick coursing behind hero panels. */
export function BrickPattern() {
  // Running-bond brick pattern: horizontal courses every 18px, joints offset on alternate rows.
  const rows = Array.from({ length: 40 }, (_, i) => i);
  const joints = Array.from({ length: 16 }, (_, i) => i);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rows.map((r) => (
        <View key={`r${r}`} style={{ position: 'absolute', left: 0, right: 0, top: r * 18, height: 18 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          {joints.map((j) => (
            <View
              key={j}
              style={{ position: 'absolute', top: 0, height: 18, width: 1, left: j * 48 + (r % 2 ? 24 : 0), backgroundColor: 'rgba(255,255,255,0.07)' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function BigButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  busy,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent';
  disabled?: boolean;
  busy?: boolean;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={22} color={v.fg} />}
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.ink, fg: colors.brandText, border: colors.ink },
  accent: { bg: colors.accent, fg: colors.text, border: colors.accent },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.border },
  danger: { bg: colors.card, fg: colors.bad, border: colors.bad },
};

export function Field({ label, style, ...props }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA3AF" style={[styles.input, style]} {...props} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={[styles.chip, { backgroundColor: colors.badBg, borderRadius: radius.control, alignSelf: 'stretch', padding: space.s }]}>
      <Ionicons name="alert-circle" size={20} color={colors.bad} />
      <Text style={{ color: colors.bad, fontSize: font.body, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xl }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

/** Empty state: an icon and one line telling the person what will appear or what to do. */
export function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.brand} />
      </View>
      <Text style={{ color: colors.muted, fontSize: font.body, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

const statusTone = {
  good: { fg: colors.good, bg: colors.goodBg, icon: 'checkmark-circle' as IconName },
  warn: { fg: colors.warn, bg: colors.warnBg, icon: 'time' as IconName },
  bad: { fg: colors.bad, bg: colors.badBg, icon: 'alert-circle' as IconName },
  neutral: { fg: colors.muted, bg: '#E7EAEE', icon: 'ellipse-outline' as IconName },
};

export type Tone = keyof typeof statusTone;

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  const s = statusTone[tone];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={17} color={s.fg} />
      <Text style={{ color: s.fg, fontSize: font.small - 1, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Reads text aloud in the current language (UX rule 5). */
export function SpeakButton({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const { t, i18n } = useTranslation();
  const fg = onDark ? colors.accent : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.listen')}
      onPress={() => {
        Speech.stop();
        Speech.speak(text, { language: i18n.language === 'ta' ? 'ta-IN' : 'en-IN' });
      }}
      style={({ pressed }) => [styles.speak, { borderColor: fg }, pressed && styles.pressed]}
    >
      <Ionicons name="volume-high" size={22} color={fg} />
      <Text style={{ color: fg, fontWeight: '600', fontSize: font.small }}>{t('common.listen')}</Text>
    </Pressable>
  );
}

/** Pick one value from a short list, as large tappable chips (no typing). */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  labelOf,
  scroll = false,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
  /** One sliding row instead of wrapping lines (for tab-like pickers). */
  scroll?: boolean;
}) {
  const chips = options.map((o) => {
    const active = o === value;
    return (
      <Pressable
        key={o}
        onPress={() => onChange(o)}
        style={[styles.pick, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}
      >
        {active && <Ionicons name="checkmark" size={16} color={colors.brandText} />}
        <Text style={{ fontSize: font.body - 1, fontWeight: active ? '600' : '400', color: active ? colors.brandText : colors.text }}>
          {labelOf(o)}
        </Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingRight: space.m }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.chipRow}>{chips}</View>;
}

export function IconLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={[styles.row, { flexWrap: 'nowrap' }]}>
      <Ionicons name={icon} size={19} color={colors.muted} />
      <Text style={{ fontSize: font.body, color: colors.text, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

/** Initials in a circle for a person (customer, supervisor, payee). */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: colors.brand }}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenBody: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.s },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: font.small, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.m,
    gap: space.s,
  },
  hero: {
    backgroundColor: colors.brandDeep,
    borderRadius: radius.hero,
    padding: space.l,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  button: {
    minHeight: minTouch,
    borderRadius: radius.control,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingHorizontal: space.m,
  },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  label: { fontSize: font.small, color: colors.muted, fontWeight: '600' },
  input: {
    minHeight: minTouch,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: space.m,
    fontSize: font.body,
    fontFamily: family.regular,
    backgroundColor: colors.card,
    color: colors.text,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.s + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  pick: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  speak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  empty: { alignItems: 'center', gap: space.s, paddingVertical: space.l },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
});
