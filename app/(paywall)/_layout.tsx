import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function PaywallLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
