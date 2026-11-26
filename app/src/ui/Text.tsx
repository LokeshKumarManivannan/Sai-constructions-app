import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { colors, family } from './theme';

const byWeight: Record<string, string> = {
  '100': family.regular,
  '200': family.regular,
  '300': family.regular,
  '400': family.regular,
  normal: family.regular,
  '500': family.medium,
  '600': family.semibold,
  '700': family.bold,
  bold: family.bold,
  '800': family.heavy,
  '900': family.heavy,
};

/**
 * App-wide Text: picks the Catamaran face that matches fontWeight
 * (custom fonts on Android ignore fontWeight, so the weight lives in the family).
 */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontFamily = flat.fontFamily ?? byWeight[String(flat.fontWeight ?? '400')] ?? family.regular;
  // Tamil script needs room above and below; set line height from the size so both scripts sit evenly.
  const size = flat.fontSize ?? 16;
  const lineHeight = flat.lineHeight ?? Math.round(size * 1.3);
  return (
    <RNText
      {...props}
      style={[
        { color: colors.text },
        flat,
        { fontFamily, fontWeight: undefined, lineHeight },
      ]}
    />
  );
}
