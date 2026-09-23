import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: color ?? colors.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
});
