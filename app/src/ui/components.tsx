import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';

import { colors, font, minTouch, space } from './theme';

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

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
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
  variant?: 'primary' | 'secondary' | 'danger';
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
          {icon && <Ionicons name={icon} size={24} color={v.fg} />}
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.brand, fg: colors.brandText, border: colors.brand },
  secondary: { bg: colors.card, fg: colors.text, border: colors.border },
  danger: { bg: colors.card, fg: colors.bad, border: colors.bad },
};

export function Field({
  label,
  ...props
}: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={[styles.chip, { backgroundColor: colors.badBg }]}>
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

const statusTone = {
  good: { fg: colors.good, bg: colors.goodBg, icon: 'checkmark-circle' as IconName },
  warn: { fg: colors.warn, bg: colors.warnBg, icon: 'time' as IconName },
  bad: { fg: colors.bad, bg: colors.badBg, icon: 'alert-circle' as IconName },
  neutral: { fg: colors.muted, bg: colors.bg, icon: 'ellipse-outline' as IconName },
};

export type Tone = keyof typeof statusTone;

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  const s = statusTone[tone];
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={18} color={s.fg} />
      <Text style={{ color: s.fg, fontSize: font.small, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Reads text aloud in the current language (UX rule 5). */
export function SpeakButton({ text }: { text: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.listen')}
      onPress={() => {
        Speech.stop();
        Speech.speak(text, { language: i18n.language === 'ta' ? 'ta-IN' : 'en-IN' });
      }}
      style={({ pressed }) => [styles.speak, pressed && styles.pressed]}
    >
      <Ionicons name="volume-high" size={26} color={colors.brand} />
      <Text style={{ color: colors.brand, fontWeight: '600', fontSize: font.small }}>{t('common.listen')}</Text>
    </Pressable>
  );
}

/** Pick one value from a short list, as large tappable chips (no typing). */
export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  labelOf,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.pick, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}
          >
            <Text style={{ fontSize: font.body, color: active ? colors.brandText : colors.text }}>{labelOf(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={{ fontSize: font.body, color: colors.text, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenBody: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2, maxWidth: 820, width: '100%', alignSelf: 'center' },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.m,
    gap: space.s,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  button: {
    minHeight: minTouch,
    borderRadius: 12,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space.m,
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.text,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
    borderRadius: 999,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  pick: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.m,
    borderRadius: 999,
    borderWidth: 1,
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
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
});
