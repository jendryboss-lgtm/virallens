import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: colors.text,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    color: colors.text,
  } satisfies TextStyle,
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    color: colors.text,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.text,
  } satisfies TextStyle,
  bodySecondary: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: colors.textMuted,
  } satisfies TextStyle,
  label: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: colors.white,
  } satisfies TextStyle,
  score: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 56,
    color: colors.text,
  } satisfies TextStyle,
} as const;
