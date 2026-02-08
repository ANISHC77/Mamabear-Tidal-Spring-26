import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const WS_URL = 'wss://athletics-agrees-drug-muslim.trycloudflare.com/';

const screenWidth = Dimensions.get('window').width;

export default function HeartRateMonitor() {
  const [currentHeartRate, setCurrentHeartRate] = useState('--');
  const [heartRateHistory, setHeartRateHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const [status, setStatus] = useState('CONNECTING...');
  const ws = useRef(null);
  const colorScheme = useColorScheme();
  const lastDefinedBpm = useRef(null);
  const lastDefinedWave = useRef([]);

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

    setConnectionStatus('CONNECTING');

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      setConnectionStatus('CONNECTED');
    };

    ws.current.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (typeof parsed.bpm === 'number') {
          lastDefinedBpm.current = parsed.bpm;
          setCurrentHeartRate(parsed.bpm);
        } else if (lastDefinedBpm.current !== null) {
          setCurrentHeartRate(lastDefinedBpm.current);
        }
        console.log('Received Heart Rate Data:', parsed.bpm);
        setStatus(parsed.status || 'UNKNOWN');
        
        // Update waveform data
        if (parsed.hr_wave && Array.isArray(parsed.hr_wave)) {
          const allNumbers = parsed.hr_wave.every((value) => typeof value === 'number');
          if (allNumbers) {
            lastDefinedWave.current = parsed.hr_wave;
            setHeartRateHistory(parsed.hr_wave);
          } else if (lastDefinedWave.current.length > 0) {
            setHeartRateHistory(lastDefinedWave.current);
          }
        } else if (lastDefinedWave.current.length > 0) {
          setHeartRateHistory(lastDefinedWave.current);
        }
      } catch (err) {
        console.error('Heart Rate JSON Parse Error:', err);
      }
    };

    ws.current.onclose = () => {
      setConnectionStatus('DISCONNECTED');
      setStatus('OFFLINE');
      // Auto-reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.current.onerror = (e) => {
      setConnectionStatus('ERROR');
    };
  }, []);

  useEffect(() => {
    connect();
    // Cleanup on unmount
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [connect]);

  const chartData = {
    labels: heartRateHistory.length > 0 ? heartRateHistory.map((_, index) => `${index}`) : ['0'],
    datasets: [
      {
        data: heartRateHistory.length > 0 ? heartRateHistory : [0],
        color: () => Colors[colorScheme ?? 'light'].tint,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: Colors[colorScheme ?? 'light'].card,
    backgroundGradientFrom: Colors[colorScheme ?? 'light'].card,
    backgroundGradientTo: Colors[colorScheme ?? 'light'].card,
    decimalPlaces: 0,
    color: () => Colors[colorScheme ?? 'light'].heartRate,
    labelColor: (opacity = 1) => Colors[colorScheme ?? 'light'].text,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '0',
    },
    propsForBackgroundLines: {
      strokeWidth: 0,
    },
    propsForLabels: {
      display: 'none',
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>❤️ Heart Rate</ThemedText>
      <ThemedView style={styles.currentContainer}>
        <ThemedText type="subtitle" style={{ opacity: 0.6, fontSize: 15, fontWeight: '600', backgroundColor: 'transparent' }}>Current BPM</ThemedText>
        <ThemedText type="title" style={{ color: Colors[colorScheme ?? 'light'].heartRate }}>{currentHeartRate}</ThemedText>
      </ThemedView>
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            width={screenWidth - 60}
            marginBottom={-20}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={false}
            withHorizontalLabels={false}
            marginLeft={-30}
          />
        </View>
      </View>
      <ThemedText style={styles.note}>
        {status} • {connectionStatus}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  currentContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 40,
    paddingHorizontal: 36,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
  },
  heartRate: {
    fontSize: 64,
    marginTop: 12,
    fontWeight: '700',
    letterSpacing: -1,

  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0,)',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  note: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    opacity: 0.6,
    fontWeight: '500',
  },
});