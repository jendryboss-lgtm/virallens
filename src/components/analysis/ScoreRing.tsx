import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme';
import { scoreColor, scoreLabel } from '@/lib/scoring';

export function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <View style={[styles.ring, { borderColor: color }]}>
      <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
      <Text style={styles.label}>{scoreLabel(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  score: { ...typography.score, fontSize: 40, lineHeight: 48 },
  label: { ...typography.caption, color: colors.textSecondary },
});
