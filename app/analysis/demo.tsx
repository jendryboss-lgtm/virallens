import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { ResultsView } from '@/components/analysis/ResultsView';
import { sampleAnalysisResult } from '@/features/analysis/sampleResult';
import { colors } from '@/theme';

/**
 * Client-only sample results — no Gemini, no upload, no entitlement check.
 * Used to demo the Results UX in Simulator / TestFlight without a live API key.
 */
export default function AnalysisDemoScreen() {
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Sample results' }} />
      <ResultsView result={sampleAnalysisResult} isSample />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
