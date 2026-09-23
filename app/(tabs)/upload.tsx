import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, DisclaimerBanner } from '@/components/ui';
import {
  PickedVideo,
  validateLocalVideo,
  createUploadSession,
  uploadVideoToSignedUrl,
  enqueueAnalysis,
  subscribeAnalysis,
} from '@/features/upload/api';
import { useAuthStore, useBillingStore } from '@/store';
import { canStartAnalysis } from '@/lib/quotas';
import { refreshBillingState } from '@/features/billing/sync';
import type { Analysis } from '@/types/database';
import { colors, spacing, typography } from '@/theme';
import { isConfigured } from '@/lib/env';

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

export default function UploadScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { plan, analysesUsed, analysesRemaining, serverEntitled } = useBillingStore();
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    return subscribeAnalysis(analysisId, (row: Analysis) => {
      if (row.status === 'queued') {
        setPhase('queued');
        setStatusMsg('Queued for analysis…');
      } else if (row.status === 'processing') {
        setPhase('processing');
        setStatusMsg('Running multimodal analysis…');
      } else if (row.status === 'completed') {
        setPhase('done');
        setStatusMsg('Analysis ready');
        if (userId) refreshBillingState(userId).catch(() => undefined);
        router.push(`/analysis/${row.id}`);
      } else if (row.status === 'failed') {
        setPhase('error');
        setStatusMsg(row.error_message ?? 'Analysis failed');
      }
    });
  }, [analysisId, router, userId]);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to pick a short.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 90,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const picked: PickedVideo = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'video/mp4',
      fileName: asset.fileName ?? 'short.mp4',
      fileSize: asset.fileSize ?? 0,
      durationSeconds: (asset.duration ?? 0) / 1000,
    };
    const err = validateLocalVideo(picked);
    if (err) {
      Alert.alert('Invalid video', err);
      return;
    }
    setVideo(picked);
    setPhase('idle');
    setStatusMsg('');
  }

  async function startUpload() {
    if (!video) return;
    if (!isConfigured()) {
      Alert.alert('Not configured', 'Set Supabase env vars before uploading.');
      return;
    }
    if (!serverEntitled || !canStartAnalysis(plan, analysesUsed)) {
      Alert.alert(
        'No analyses remaining',
        `You have ${analysesRemaining} left on your current plan. Upgrade or wait for the next period.`,
      );
      router.push('/(paywall)/index');
      return;
    }

    setPhase('uploading');
    setStatusMsg('Creating secure upload…');
    try {
      const session = await createUploadSession({
        mimeType: video.mimeType,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.fileSize,
      });
      setAnalysisId(session.analysisId);
      setStatusMsg('Uploading video…');
      await uploadVideoToSignedUrl(video.uri, session.uploadUrl, video.mimeType);
      setStatusMsg('Enqueueing analysis…');
      await enqueueAnalysis(session.analysisId);
      setPhase('queued');
      setStatusMsg('Queued for analysis…');
    } catch (e: unknown) {
      setPhase('error');
      setStatusMsg(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Analyze a short</Text>
      <Text style={styles.sub}>
        MP4/MOV · max 90s · max 100MB. Remaining this period: {analysesRemaining}
      </Text>

      <Button title="Choose video" variant="secondary" onPress={pick} />

      {video ? (
        <Card style={styles.preview}>
          <Video
            source={{ uri: video.uri }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
          />
          <Text style={styles.meta}>
            {video.fileName} · {video.durationSeconds.toFixed(1)}s ·{' '}
            {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
          </Text>
          <Button
            title="Start analysis"
            onPress={startUpload}
            loading={phase === 'uploading'}
            disabled={phase === 'uploading' || phase === 'queued' || phase === 'processing'}
          />
        </Card>
      ) : null}

      {statusMsg ? (
        <Text style={[styles.status, phase === 'error' && { color: colors.danger }]}>
          {statusMsg}
        </Text>
      ) : null}

      <View style={{ height: spacing.xl }} />
      <DisclaimerBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.sm },
  sub: { ...typography.bodySecondary, marginBottom: spacing.xl },
  preview: { marginTop: spacing.xl, gap: spacing.md },
  video: { width: '100%', height: 280, backgroundColor: colors.bgElevated, borderRadius: 12 },
  meta: { ...typography.caption },
  status: { ...typography.body, color: colors.accent, marginTop: spacing.lg, textAlign: 'center' },
});
