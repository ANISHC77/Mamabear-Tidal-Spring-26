import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const WS_URL = 'wss://athletics-agrees-drug-muslim.trycloudflare.com/';

const screenWidth = Dimensions.get('window').width;

export default function RespiratoryRateMonitor() {
  const [currentRespiratoryRate, setCurrentRespiratoryRate] = useState('--');
  const [respiratoryRateHistory, setRespiratoryRateHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const [status, setStatus] = useState('CONNECTING...');
  const ws = useRef(null);
  const colorScheme = useColorScheme();
  const lastDefinedRpm = useRef(null);
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
        if (typeof parsed.rpm === 'number') {
          lastDefinedRpm.current = parsed.rpm;
          setCurrentRespiratoryRate(parsed.rpm);
        } else if (lastDefinedRpm.current !== null) {
          setCurrentRespiratoryRate(lastDefinedRpm.current);
        }
        setStatus(parsed.status || 'UNKNOWN');
        
        // Update waveform data
        if (parsed.rr_wave && Array.isArray(parsed.rr_wave)) {
          const allNumbers = parsed.rr_wave.every((value) => typeof value === 'number');
          if (allNumbers) {
            lastDefinedWave.current = parsed.rr_wave;
            setRespiratoryRateHistory(parsed.rr_wave);
          } else if (lastDefinedWave.current.length > 0) {
            setRespiratoryRateHistory(lastDefinedWave.current);
          }
        } else if (lastDefinedWave.current.length > 0) {
          setRespiratoryRateHistory(lastDefinedWave.current);
        }
      } catch (err) {
        console.error('Respiratory Rate JSON Parse Error:', err);
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
    labels: respiratoryRateHistory.length > 0 ? respiratoryRateHistory.map((_, index) => `${index}`) : ['0'],
    datasets: [
      {
        data: respiratoryRateHistory.length > 0 ? respiratoryRateHistory : [16],
        color: () => '#00BFFF', // Light blue for respiratory
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: Colors[colorScheme ?? 'light'].card,
    backgroundGradientFrom: Colors[colorScheme ?? 'light'].card,
    backgroundGradientTo: Colors[colorScheme ?? 'light'].card,
    decimalPlaces: 0,
    color: () => Colors[colorScheme ?? 'light'].respiratory,
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
      <ThemedText type="title" style={styles.title}>🫁 Respiratory Rate</ThemedText>
      <ThemedView style={styles.currentContainer}>
        <ThemedText type="subtitle" style={{ opacity: 0.6, fontSize: 15, fontWeight: '600',  }}>Breaths Per Minute</ThemedText>
        <ThemedText type="title" style={ { color: Colors[colorScheme ?? 'light'].respiratory }}>{currentRespiratoryRate}</ThemedText>
      </ThemedView>
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            width={screenWidth - 92}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={false}
            withHorizontalLabels={false}
            bezier
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
    padding: 24,
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
    backgroundColor: 'rgba(90, 200, 250, 0.08)',
  },
  respiratoryRate: {
    fontSize: 64,
    marginTop: 12,
    fontWeight: '700',
    letterSpacing: -1.5,
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
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  note: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    opacity: 0.5,
    fontWeight: '500',
  },
});