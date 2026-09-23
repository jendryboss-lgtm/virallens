import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Screen, TextField } from '@/components/ui';
import { signInWithEmail } from '@/features/auth/api';
import { colors, spacing, typography } from '@/theme';
import { isConfigured } from '@/lib/env';

const Schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});

type Form = z.infer<typeof Schema>;

export default function SignInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!isConfigured()) {
      Alert.alert('Not configured', 'Add Supabase keys in .env to sign in.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(values.email.trim(), values.password);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Screen scroll>
      <Text style={styles.title}>Welcome back</Text>
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
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
        <Button title="Sign in" loading={loading} onPress={onSubmit} />
      </View>
      <Link href="/(auth)/sign-up" style={styles.link}>
        Need an account? Sign up
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  link: { ...typography.body, color: colors.accent, marginTop: spacing.xl, textAlign: 'center' },
});
