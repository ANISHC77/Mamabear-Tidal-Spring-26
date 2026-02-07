import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const screenWidth = Dimensions.get('window').width;

export default function HeartRateMonitor() {
  const [currentHeartRate, setCurrentHeartRate] = useState(72);
  const [heartRateHistory, setHeartRateHistory] = useState([
    { heartRate: 0, timestamp: Date.now() - 49000 },
    { heartRate: 0, timestamp: Date.now() - 48000 },
    { heartRate: 0, timestamp: Date.now() - 47000 },
    { heartRate: 0, timestamp: Date.now() - 46000 },
    { heartRate: 0, timestamp: Date.now() - 45000 },
    { heartRate: 0, timestamp: Date.now() - 44000 },
    { heartRate: 0, timestamp: Date.now() - 43000 },
    { heartRate: 0, timestamp: Date.now() - 42000 },
    { heartRate: 0, timestamp: Date.now() - 41000 },
    { heartRate: 0, timestamp: Date.now() - 40000 },
    { heartRate: 0, timestamp: Date.now() - 39000 },
    { heartRate: 0, timestamp: Date.now() - 38000 },
    { heartRate: 0, timestamp: Date.now() - 37000 },
    { heartRate: 0, timestamp: Date.now() - 36000 },
    { heartRate: 0, timestamp: Date.now() - 35000 },
    { heartRate: 0, timestamp: Date.now() - 34000 },
    { heartRate: 0, timestamp: Date.now() - 33000 },
    { heartRate: 0, timestamp: Date.now() - 32000 },
    { heartRate: 0, timestamp: Date.now() - 31000 },
    { heartRate: 0, timestamp: Date.now() - 30000 },
  ]);
  const colorScheme = useColorScheme();

  // Function to generate EKG-like waveform
  const generateEKGValue = () => {
    const time = Date.now() % 1000; // Cycle every second
    const phase = (time / 1000) * Math.PI * 2; // Convert to radians

    // Create EKG-like pattern: baseline with periodic spikes
    let value = 0;

    // P wave (small positive deflection)
    if (phase > 0.1 && phase < 0.2) {
      value = Math.sin((phase - 0.1) * 20) * 0.3;
    }
    // QRS complex (sharp spike)
    else if (phase > 0.3 && phase < 0.5) {
      const qrsPhase = (phase - 0.3) / 0.2;
      if (qrsPhase < 0.3) value = -Math.sin(qrsPhase * Math.PI) * 1.5; // Q wave
      else if (qrsPhase < 0.7) value = Math.sin((qrsPhase - 0.3) * Math.PI / 0.4) * 2.5; // R wave
      else value = -Math.sin((qrsPhase - 0.7) * Math.PI / 0.3) * 1.2; // S wave
    }
    // T wave (smaller positive deflection)
    else if (phase > 0.7 && phase < 0.9) {
      value = Math.sin((phase - 0.7) * 8) * 0.8;
    }

    // Add some baseline variation and noise
    value += Math.sin(phase * 4) * 0.1 + (Math.random() - 0.5) * 0.2;

    // Scale to heart rate range (60-100 BPM) and add baseline
    return Math.round(75 + value * 10);
  };

  // Function to fetch heart rate - replace with API call
  const fetchHeartRate = async () => {
    // Simulate API call - replace with actual API
    return generateEKGValue();
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newHeartRate = await fetchHeartRate();
        setCurrentHeartRate(newHeartRate);

        const newDataPoint = {
          heartRate: newHeartRate,
          timestamp: Date.now(),
        };

        setHeartRateHistory(prev => {
          const updated = [...prev, newDataPoint];
          // Keep only last 50 data points for the graph
          return updated.slice(-50);
        });
      } catch (error) {
        console.error('Failed to fetch heart rate:', error);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: heartRateHistory.length > 0 ? heartRateHistory.map((_, index) => `${index}`) : ['0'],
    datasets: [
      {
        data: heartRateHistory.length > 0 ? heartRateHistory.map(d => d.heartRate) : [72],
        color: () => Colors[colorScheme ?? 'light'].tint,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: Colors[colorScheme ?? 'light'].background,
    backgroundGradientFrom: Colors[colorScheme ?? 'light'].background,
    backgroundGradientTo: Colors[colorScheme ?? 'light'].background,
    decimalPlaces: 0,
    color: () => '#00FF00', // Classic EKG green color
    labelColor: (opacity = 1) => Colors[colorScheme ?? 'light'].text,
    style: {
      borderRadius: 0, // Remove border radius for medical look
    },
    propsForDots: {
      r: '0', // Remove dots for cleaner EKG look
    },
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>❤️ Heart Rate Monitor</ThemedText>
      <ThemedView style={styles.currentContainer}>
        <ThemedText type="subtitle">Current Heart Rate:</ThemedText>
        <ThemedText type="title" style={styles.heartRate}>{currentHeartRate} BPM</ThemedText>
      </ThemedView>
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            width={screenWidth - 40}
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
        Real-time EKG-style heart rate monitoring with live waveform
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
  heartRate: {
    fontSize: 24,
    color: '#FF6B6B',
    marginTop: 10,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: 1,
    backgroundColor: 'black', // Black background for EKG style
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',

  },
  chart: {
    marginVertical: 8,
    borderRadius: 20, // Medical style - no rounded corners
    borderWidth: 1,
    borderColor: '#333',
    alignSelf: 'center',
  },
  note: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    opacity: 0.7,
  },
});