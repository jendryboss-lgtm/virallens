import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Screen, TextField } from '@/components/ui';
import { signUpWithEmail, upsertProfile } from '@/features/auth/api';
import { colors, spacing, typography } from '@/theme';
import { isConfigured } from '@/lib/env';

const Schema = z
  .object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type Form = z.infer<typeof Schema>;

export default function SignUpScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!isConfigured()) {
      Alert.alert('Not configured', 'Add Supabase keys in .env to sign up.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await signUpWithEmail(values.email.trim(), values.password);
      if (user) {
        await upsertProfile(user.id, {
          email: values.email.trim(),
          onboarding_completed: false,
          ai_consent: false,
        });
      }
      Alert.alert('Check your email', 'Confirm your address if required, then continue onboarding.');
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Screen scroll>
      <Text style={styles.title}>Create your account</Text>
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={formState.errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Password"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={formState.errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Confirm password"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={formState.errors.confirm?.message}
            />
          )}
        />
        <Button title="Create account" loading={loading} onPress={onSubmit} />
      </View>
      <Link href="/(auth)/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  link: { ...typography.body, color: colors.accent, marginTop: spacing.xl, textAlign: 'center' },
});
