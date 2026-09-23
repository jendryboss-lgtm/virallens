import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
import { Button, Card, ProgressBar, Screen, DisclaimerBanner } from '@/components/ui';
import {
  PickedVideo,
  validateLocalVideo,
  createUploadSession,
  uploadVideoToSignedUrl,
  enqueueAnalysis,
  subscribeAnalysis,
  cancelAnalysis,
} from '@/features/upload/api';
import { useAuthStore, useBillingStore } from '@/store';
import { canStartAnalysis } from '@/lib/quotas';
import { analysisStageProgress } from '@/lib/geminiHelpers';
import { refreshBillingState } from '@/features/billing/sync';
import type { Analysis } from '@/types/database';
import { colors, spacing, typography } from '@/theme';
import { isConfigured } from '@/lib/env';

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error' | 'cancelled';


function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function UploadScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { plan, analysesUsed, analysesRemaining, serverEntitled } = useBillingStore();
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const progress = useMemo(() => {
    if (phase === 'uploading') return { label: 'Uploading video', percent: 25 };
    if (phase === 'cancelled') return { label: 'Cancelled', percent: 0 };
    if (phase === 'error') return { label: statusMsg || 'Error', percent: 100 };
    if (serverStatus) return analysisStageProgress(serverStatus);
    if (phase === 'queued') return analysisStageProgress('queued');
    if (phase === 'processing') return analysisStageProgress('processing');
    if (phase === 'done') return analysisStageProgress('completed');
    return { label: 'Ready', percent: 0 };
  }, [phase, serverStatus, statusMsg]);

  useEffect(() => {
    if (!analysisId) return;
    return subscribeAnalysis(analysisId, (row: Analysis) => {
      if (cancelledRef.current) return;
      setServerStatus(row.status);
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
    cancelledRef.current = false;
    setVideo(picked);
    setPhase('idle');
    setStatusMsg('');
    setAnalysisId(null);
    setServerStatus(null);
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

    cancelledRef.current = false;
    setPhase('uploading');
    setStatusMsg('Creating secure upload…');
    try {
      const session = await createUploadSession({
        mimeType: video.mimeType,
        durationSeconds: video.durationSeconds,
        sizeBytes: video.fileSize,
      });
      if (cancelledRef.current) {
        await cancelAnalysis(session.analysisId).catch(() => undefined);
        return;
      }
      setAnalysisId(session.analysisId);
      setStatusMsg('Uploading video…');
      await uploadVideoToSignedUrl(video.uri, session.uploadUrl, video.mimeType);
      if (cancelledRef.current) {
        await cancelAnalysis(session.analysisId).catch(() => undefined);
        return;
      }
      setStatusMsg('Enqueueing analysis…');
      await enqueueAnalysis(session.analysisId);
      setPhase('queued');
      setServerStatus('queued');
      setStatusMsg('Queued for analysis…');
    } catch (e: unknown) {
      if (cancelledRef.current) return;
      setPhase('error');
      setStatusMsg(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function onCancel() {
    cancelledRef.current = true;
    const id = analysisId;
    setPhase('cancelled');
    setStatusMsg('Cancelled');
    setServerStatus(null);
    if (id) {
      try {
        await cancelAnalysis(id);
      } catch {
        /* best effort */
      }
    }
    setAnalysisId(null);
  }

  const inFlight =
    phase === 'uploading' || phase === 'queued' || phase === 'processing';

  return (
    <Screen scroll>
      <Text style={styles.title}>Check an unposted draft</Text>
      <Text style={styles.sub}>
        Pick a short from Camera Roll before you post. MP4/MOV/WebM · max 90s · max 100MB.
        Remaining this period: {analysesRemaining}
      </Text>

      <Button title="Choose from Camera Roll" variant="secondary" onPress={pick} disabled={inFlight} />
      {!serverEntitled ? (
        <Button
          title="Preview sample results"
          variant="ghost"
          onPress={() => router.push('/analysis/demo')}
          style={{ marginTop: spacing.md }}
          disabled={inFlight}
        />
      ) : null}

      {video ? (
        <Card style={styles.preview}>
          <VideoPreview uri={video.uri} />
          <Text style={styles.meta}>
            {video.fileName} · {video.durationSeconds.toFixed(1)}s ·{' '}
            {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
          </Text>
          <Button
            title="Start analysis"
            onPress={startUpload}
            loading={phase === 'uploading'}
            disabled={inFlight}
          />
        </Card>
      ) : null}

      {phase !== 'idle' || statusMsg ? (
        <Card style={styles.progressCard}>
          <Text style={styles.stage}>{progress.label}</Text>
          <ProgressBar value={progress.percent} color={phase === 'error' ? colors.danger : colors.accent} />
          {statusMsg ? (
            <Text style={[styles.status, phase === 'error' && { color: colors.danger }]}>
              {statusMsg}
            </Text>
          ) : null}
          {inFlight ? (
            <Button title="Cancel analysis" variant="ghost" onPress={onCancel} />
          ) : null}
        </Card>
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
  progressCard: { marginTop: spacing.xl, gap: spacing.md },
  stage: { ...typography.label, color: colors.accent },
  status: { ...typography.body, color: colors.accent, textAlign: 'center' },
});
