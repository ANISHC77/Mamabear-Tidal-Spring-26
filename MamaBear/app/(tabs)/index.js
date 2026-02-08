import React, { useState, useEffect, useRef } from 'react';
import { Image, View, Text, StyleSheet, Dimensions, Platform } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import HeartRateMonitor from '@/components/heart-rate-monitor';
import RespiratoryRateMonitor from '@/components/respiratory-rate-monitor';

const WS_URL = 'wss://consisting-powell-width-kitty.trycloudflare.com';
const SCREEN_WIDTH = Dimensions.get('window').width;
const VIDEO_HEIGHT = 240;

export default function HomeScreen() {
  const [videoData, setVideoData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const [backendStatus, setBackendStatus] = useState('UNKNOWN');
  const ws = useRef(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const connect = () => {
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

      setConnectionStatus('CONNECTING');

      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnectionStatus('CONNECTED');
      };

      ws.current.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.video) {
            setVideoData(parsed.video);
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
    };
  }, []);

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
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.statusContainer}>
        <ThemedText type="subtitle">System Status:</ThemedText>
        <ThemedText type="title" style={[styles.statusValue, { color: Colors[colorScheme ?? 'light'].tint }]}>{backendStatus}</ThemedText>
      </ThemedView>
      <HeartRateMonitor />
      <RespiratoryRateMonitor />
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: '#2a2d2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 55,
    right: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusValue: {
    fontSize: 24,
    marginTop: 10,
  },
});
