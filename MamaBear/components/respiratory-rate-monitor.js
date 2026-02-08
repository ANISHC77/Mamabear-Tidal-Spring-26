import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const WS_URL = 'wss://huffily-triploblastic-tabetha.ngrok-free.dev';

const screenWidth = Dimensions.get('window').width;

export default function RespiratoryRateMonitor() {
  const [currentRespiratoryRate, setCurrentRespiratoryRate] = useState('--');
  const [respiratoryRateHistory, setRespiratoryRateHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED');
  const [status, setStatus] = useState('CONNECTING...');
  const ws = useRef(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    connect();
    // Cleanup on unmount
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const connect = () => {
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
        setCurrentRespiratoryRate(parsed.rpm || '--');
        setStatus(parsed.status || 'UNKNOWN');
        
        // Update waveform data
        if (parsed.rr_wave && Array.isArray(parsed.rr_wave)) {
          setRespiratoryRateHistory(parsed.rr_wave);
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
  };

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
    backgroundColor: Colors[colorScheme ?? 'light'].background,
    backgroundGradientFrom: Colors[colorScheme ?? 'light'].background,
    backgroundGradientTo: Colors[colorScheme ?? 'light'].background,
    decimalPlaces: 0,
    color: () => '#00BFFF', // Light blue for respiratory
    labelColor: (opacity = 1) => Colors[colorScheme ?? 'light'].text,
    style: {
      borderRadius: 0, // Remove border radius for medical look
    },
    propsForDots: {
      r: '0', // Remove dots for cleaner EKG look
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
      <ThemedText type="title" style={styles.title}>🫁 Respiratory Rate Monitor</ThemedText>
      <ThemedView style={styles.currentContainer}>
        <ThemedText type="subtitle">Current Respiratory Rate:</ThemedText>
        <ThemedText type="title" style={styles.respiratoryRate}>{currentRespiratoryRate} breaths/min</ThemedText>
        <ThemedText type="subtitle" style={styles.status}>
          Status: {status} | Connection: {connectionStatus}
        </ThemedText>
      </ThemedView>
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            width={screenWidth - 60}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={false}
            withHorizontalLabels={false}
          />
        </View>
      </View>
      <ThemedText style={styles.note}>
        Real-time respiratory monitoring with live waveform
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginVertical: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  currentContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  respiratoryRate: {
    fontSize: 24,
    color: '#00BFFF',
    marginTop: 10,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: 1,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',

  },
  chart: {
    marginVertical: 0,
    borderRadius: 20, // Medical style - no rounded corners
    borderWidth: 1,
    width: '50%',
    borderColor: '#333',
    alignSelf: 'center',
    backgroundColor: 'black', // Black background for EKG style
  },
  note: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    opacity: 0.7,
  },
});