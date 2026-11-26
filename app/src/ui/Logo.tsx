import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from './theme';

/** Chettinad arch framing an S. `onDark` draws it in cement for laterite/charcoal backgrounds. */
export function Logo({ size = 40, onDark = false }: { size?: number; onDark?: boolean }) {
  const arch = onDark ? '#F2F0ED' : colors.brand;
  const ink = onDark ? colors.accent : colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Sai Constructions">
      <Path d="M24 106 L24 58 Q24 22 60 22 Q96 22 96 58 L96 106" fill="none" stroke={arch} strokeWidth={10} strokeLinecap="square" />
      <Path d="M42 106 L42 64 Q42 42 60 42 Q78 42 78 64 L78 106" fill="none" stroke={arch} strokeWidth={4} />
      <Rect x={16} y={104} width={88} height={6} rx={1} fill={onDark ? '#F2F0ED' : colors.ink} />
      <Path
        d="M51 74 Q51 66 60 66 Q69 66 69 72 Q69 78 60 80 Q51 82 51 88 Q51 94 60 94 Q69 94 69 86"
        fill="none"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
