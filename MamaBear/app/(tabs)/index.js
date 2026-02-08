import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Image, View, Text, StyleSheet, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import HeartRateMonitor from '@/components/heart-rate-monitor';
import RespiratoryRateMonitor from '@/components/respiratory-rate-monitor';

const WS_URL = 'wss://thehun-christine-relocation-additional.trycloudflare.com/';
const SCREEN_WIDTH = Dimensions.get('window').width;
const VIDEO_HEIGHT = 240;
const RECORDINGS_KEY = '@mama_bear_recordings';
const FRAME_BUFFER_SIZE = 5; // Keep last 5 frames before alert
const AUDIO_THROTTLE_MS = 250;

const pcmToWav = (base64PCM) => {
  if (!base64PCM) return null;
  const atobFn = globalThis?.atob;
  const btoaFn = globalThis?.btoa;
  if (typeof atobFn !== 'function' || typeof btoaFn !== 'function') return null;
  const binaryString = atobFn(base64PCM);
  const pcm = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcm[i] = binaryString.charCodeAt(i);
  }
  const sampleRate = 16000;
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const wavHeader = new Uint8Array(44);
  const view = new DataView(wavHeader.buffer);
  wavHeader[0] = 0x52; wavHeader[1] = 0x49; wavHeader[2] = 0x46; wavHeader[3] = 0x46;
  view.setUint32(4, 36 + pcm.length, true);
  wavHeader[8] = 0x57; wavHeader[9] = 0x41; wavHeader[10] = 0x56; wavHeader[11] = 0x45;
  wavHeader[12] = 0x66; wavHeader[13] = 0x6d; wavHeader[14] = 0x74; wavHeader[15] = 0x20;
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  wavHeader[36] = 0x64; wavHeader[37] = 0x61; wavHeader[38] = 0x74; wavHeader[39] = 0x61;
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(wavHeader.length + pcm.length);
  wav.set(wavHeader, 0);
  wav.set(pcm, wavHeader.length);
  let wavBinary = '';
  for (let i = 0; i < wav.length; i++) {
    wavBinary += String.fromCharCode(wav[i]);
  }
  const wavBase64 = btoaFn(wavBinary);
  return `data:audio/wav;base64,${wavBase64}`;
};

export default function HomeScreen() {
  const [videoData, setVideoData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const [backendStatus, setBackendStatus] = useState('UNKNOWN');
  const ws = useRef(null);
  const colorScheme = useColorScheme();
  const liveAudioPlayer = useRef(null);
  const lastAudioAt = useRef(0);
  
  // Recording state
  const frameBuffer = useRef([]); // Keep last 5 frames
  const isRecording = useRef(false);
  const recordingFrames = useRef([]);
  const recordingAlertType = useRef(null);
  const previousStatus = useRef('UNKNOWN');

  const saveRecording = useCallback(async () => {
    try {
      const recording = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        alertType: recordingAlertType.current,
        frames: recordingFrames.current,
      };

      console.log('💾 Saving recording:', recording.alertType, recording.frames.length, 'frames');

      const stored = await AsyncStorage.getItem(RECORDINGS_KEY);
      const recordings = stored ? JSON.parse(stored) : [];

      recordings.unshift(recording);
      if (recordings.length > 20) {
        recordings.splice(20);
      }

      await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));

      isRecording.current = false;
      recordingFrames.current = [];
      recordingAlertType.current = null;

      console.log('✅ Recording saved successfully');
    } catch (error) {
      console.error('❌ Error saving recording:', error);
      isRecording.current = false;
      recordingFrames.current = [];
    }
  }, []);

  // Handle frame recording for alerts
  const handleFrameRecording = useCallback((frameData, status) => {
    // Always maintain a buffer of last 5 frames (video+audio)
    frameBuffer.current.push(frameData);
    if (frameBuffer.current.length > FRAME_BUFFER_SIZE) {
      frameBuffer.current.shift();
    }

    // Check if alert just started (status changed to alert)
    const isAlertStatus = status && (
      status.includes('ALERT') || 
      status.includes('CRYING') || 
      status.includes('BREATHING') ||
      status.includes('MOVEMENT')
    );

    // Check if alert just ended (was alert, now not alert)
    const wasAlertStatus = previousStatus.current && (
      previousStatus.current.includes('ALERT') || 
      previousStatus.current.includes('CRYING') || 
      previousStatus.current.includes('BREATHING') ||
      previousStatus.current.includes('MOVEMENT')
    );

    if (isAlertStatus && !isRecording.current) {
      // Alert detected! Start recording
      console.log('🔴 Alert detected, starting recording:', status);
      isRecording.current = true;
      recordingAlertType.current = status;
      // Copy the buffer (last 5 frames before alert)
      recordingFrames.current = [...frameBuffer.current];
    }

    if (isRecording.current) {
      // Continue recording until alert ends
      recordingFrames.current.push(frameData);

      // Check if alert has ended
      if (wasAlertStatus && !isAlertStatus) {
        console.log('🟢 Alert ended, saving recording with', recordingFrames.current.length, 'frames');
        saveRecording();
      }
    }

    previousStatus.current = status;
  }, [saveRecording]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    const connect = () => {
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

      setConnectionStatus('CONNECTING');

      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnectionStatus('CONNECTED');
      };

      ws.current.onmessage = async (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.video) {
            setVideoData(parsed.video);
            // Pass both video and audio for recording
            handleFrameRecording({ video: parsed.video, audio: parsed.audio }, parsed.status);
          }
          // Live audio playback
          if (parsed.audio) {
            try {
              const now = Date.now();
              if (now - lastAudioAt.current < AUDIO_THROTTLE_MS) return;
              lastAudioAt.current = now;
              const wavUri = pcmToWav(parsed.audio);
              if (!wavUri) return;
              const { sound } = await Audio.Sound.createAsync({ uri: wavUri }, { shouldPlay: true });
              liveAudioPlayer.current = sound;
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                  sound.unloadAsync().catch(() => {});
                  if (liveAudioPlayer.current === sound) {
                    liveAudioPlayer.current = null;
                  }
                }
              });
            } catch (_err) {
              // Ignore audio errors
            }
          }
          if (parsed.status) {
            setBackendStatus(parsed.status);
          }
        } catch (err) {
          console.error('Video WebSocket parse error:', err);
        }
      };

      ws.current.onclose = () => {
        setConnectionStatus('DISCONNECTED');
        setTimeout(connect, 2000);
      };

      ws.current.onerror = (e) => {
        setConnectionStatus('ERROR');
      };
    };

    connect();

    return () => {
      if (ws.current) ws.current.close();
      if (liveAudioPlayer.current) {
        liveAudioPlayer.current.unloadAsync().catch(() => {});
        liveAudioPlayer.current = null;
      }
    };
  }, [handleFrameRecording]);

  const getStatusColor = (status) => {
    if (!status) return '#555';
    if (status.includes('ALERT') || status === 'ERROR') return Colors[colorScheme ?? 'light'].accent;
    if (status.includes('SAFE') || status === 'CONNECTED') return Colors[colorScheme ?? 'light'].tint;
    return '#888';
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: Colors.light.background, dark: Colors.dark.background }}
      headerImage={
        <View style={styles.videoContainer}>
          {videoData ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${videoData}` }}
              style={styles.video}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.placeholderText}>
                {connectionStatus === 'CONNECTING' ? 'CONNECTING TO VIDEO FEED...' :
                 connectionStatus === 'CONNECTED' ? 'WAITING FOR VIDEO...' :
                 connectionStatus === 'ERROR' ? 'CONNECTION ERROR' : 'VIDEO FEED OFFLINE'}
              </Text>
            </View>
          )}

          {/* Status Overlay on Video */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(connectionStatus) }]}>
            <Text style={styles.statusText}>{connectionStatus}</Text>
          </View>
        </View>
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={styles.mainTitle}>Mama Bear 🍼</ThemedText>
      </ThemedView>
      <ThemedView style={styles.statusCard}>
        <ThemedText type="subtitle" style={styles.statusLabel}>System Status</ThemedText>
        <ThemedText type="title" style={[styles.statusValue, { color: Colors[colorScheme ?? 'light'].success }]}>{backendStatus}</ThemedText>
      </ThemedView>
      <HeartRateMonitor />
      <RespiratoryRateMonitor />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statusBadge: {
    position: 'absolute',
    top: 55,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusCard: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusLabel: {
    opacity: 0.6,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
