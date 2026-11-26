import { View } from 'react-native';

import { colors } from './theme';

/**
 * The house going up: one floor slab per payment stage, filled in site amber from the ground
 * as stages finish. Readable without any words.
 */
export function BuildingProgress({
  total,
  done,
  size = 'small',
  onDark = false,
}: {
  total: number;
  done: number;
  size?: 'small' | 'large';
  onDark?: boolean;
}) {
  const floors = Math.max(total, 1);
  const w = size === 'large' ? 96 : 46;
  const slab = size === 'large' ? Math.max(8, Math.min(16, 120 / floors)) : Math.max(4, Math.min(8, 56 / floors));
  const gap = size === 'large' ? 3 : 2;
  const empty = onDark ? 'rgba(255,255,255,0.14)' : '#DCE2E9';
  const roofEmpty = onDark ? 'rgba(255,255,255,0.22)' : '#C9D1DB';
  const finished = total > 0 && done >= total;

  return (
    <View accessibilityLabel={`${done} / ${total}`} style={{ width: w, alignItems: 'center' }}>
      {/* roof */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: w / 2 + 4,
          borderRightWidth: w / 2 + 4,
          borderBottomWidth: size === 'large' ? 26 : 13,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: finished ? colors.accent : roofEmpty,
          marginBottom: gap,
        }}
      />
      {/* floors, top to bottom; filled from the ground up */}
      {Array.from({ length: floors }, (_, i) => {
        const fromGround = floors - i;
        const filled = fromGround <= done;
        return (
          <View
            key={i}
            style={{ width: w, height: slab, marginBottom: gap, borderRadius: 2, backgroundColor: filled ? colors.accent : empty }}
          />
        );
      })}
      {/* ground line */}
      <View style={{ width: w + 14, height: size === 'large' ? 4 : 2, borderRadius: 2, backgroundColor: onDark ? 'rgba(255,255,255,0.45)' : colors.muted }} />
    </View>
  );
}
