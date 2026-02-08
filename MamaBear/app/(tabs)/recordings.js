import React, { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ActivityIndicator, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDINGS_KEY = '@mama_bear_recordings';
const FRAME_RATE = 30; // 30 fps

export default function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const playbackInterval = useRef(null);
  const audioPlayer = useRef(null);

  useEffect(() => {
    loadRecordings();
    const interval = setInterval(loadRecordings, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadRecordings = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECORDINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecordings(parsed.sort((a, b) => b.timestamp - a.timestamp));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading recordings:', error);
      setLoading(false);
    }
  };

  const deleteRecording = async (id) => {
    try {
      const updated = recordings.filter(r => r.id !== id);
      await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
      setRecordings(updated);
      if (selectedRecording?.id === id) {
        setSelectedRecording(null);
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getAlertColor = (alertType) => {
    if (alertType.includes('CRYING')) return '#FF9500';
    if (alertType.includes('BREATHING')) return '#FF3B30';
    if (alertType.includes('MOVEMENT')) return '#FFCC00';
    return '#8E8E93';
  };

  // Helper: Convert base64 PCM to WAV URI for expo-av (React Native compatible)
  const pcmToWav = (base64PCM) => {
    if (!base64PCM) return null;
    // Decode base64 to Uint8Array
    const binaryString = atob(base64PCM);
    const pcm = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcm[i] = binaryString.charCodeAt(i);
    }
    // WAV header for mono 16-bit PCM, 16kHz
    const sampleRate = 16000;
    const numChannels = 1;
    const byteRate = sampleRate * numChannels * 2;
    const wavHeader = new Uint8Array(44);
    const view = new DataView(wavHeader.buffer);
    // 'RIFF'
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
    // Combine header and PCM
    const wav = new Uint8Array(wavHeader.length + pcm.length);
    wav.set(wavHeader, 0);
    wav.set(pcm, wavHeader.length);
    // Convert to base64
    let wavBinary = '';
    for (let i = 0; i < wav.length; i++) {
      wavBinary += String.fromCharCode(wav[i]);
    }
    const wavBase64 = btoa(wavBinary);
    return `data:audio/wav;base64,${wavBase64}`;
  };

  const playRecording = async () => {
    if (!selectedRecording) return;
    setIsPlaying(true);
    setCurrentFrame(0);
    // Play first frame audio
    await playAudioForFrame(0);
    playbackInterval.current = setInterval(async () => {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= selectedRecording.frames.length) {
          stopRecording();
          return 0;
        }
        playAudioForFrame(next);
        return next;
      });
    }, 1000 / FRAME_RATE);
  };

  const playAudioForFrame = async (frameIdx) => {
    if (!selectedRecording) return;
    const frame = selectedRecording.frames[frameIdx];
    if (!frame || !frame.audio) return;
    try {
      if (audioPlayer.current) {
        await audioPlayer.current.unloadAsync();
      }
      const wavUri = pcmToWav(frame.audio);
      if (!wavUri) return;
      const { sound } = await Audio.Sound.createAsync({ uri: wavUri });
      audioPlayer.current = sound;
      await sound.playAsync();
    } catch (err) {
      // Ignore audio errors
    }
  };

  const stopRecording = async () => {
    setIsPlaying(false);
    if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
      playbackInterval.current = null;
    }
    if (audioPlayer.current) {
      try {
        await audioPlayer.current.unloadAsync();
      } catch {}
      audioPlayer.current = null;
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopRecording();
    } else {
      playRecording();
    }
  };

  // Clean up interval on unmount or when recording changes
  useEffect(() => {
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, [selectedRecording]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34C759" />
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedRecording) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => {
            stopRecording();
            setSelectedRecording(null);
          }} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.detailTitleContainer}>
            <Text style={styles.detailTitle}>{selectedRecording.alertType}</Text>
            <Text style={styles.detailTimestamp}>{formatTimestamp(selectedRecording.timestamp)}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              stopRecording();
              deleteRecording(selectedRecording.id);
            }} 
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Video Player */}
        <View style={styles.videoPlayer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${selectedRecording.frames[currentFrame]?.video}` }}
            style={styles.videoFrame}
            resizeMode="contain"
          />
          {/* Playback Controls */}
          <View style={styles.playbackControls}>
            <TouchableOpacity onPress={togglePlayback} style={styles.playBtn}>
              <Text style={styles.playBtnText}>{isPlaying ? '⏸️ Pause' : '▶️ Play'}</Text>
            </TouchableOpacity>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Frame {currentFrame + 1} / {selectedRecording.frames.length}
              </Text>
              <Text style={styles.timeText}>
                {(currentFrame / FRAME_RATE).toFixed(2)}s / {(selectedRecording.frames.length / FRAME_RATE).toFixed(2)}s
              </Text>
            </View>
          </View>
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${((currentFrame + 1) / selectedRecording.frames.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <View style={styles.frameInfo}>
          <Text style={styles.frameInfoText}>
            {selectedRecording.frames.length} frames • {(selectedRecording.frames.length / FRAME_RATE).toFixed(1)}s recording
          </Text>
        </View>

        <FlatList
          data={selectedRecording.frames}
          keyExtractor={(item, index) => `frame-${index}`}
          numColumns={3}
          contentContainerStyle={styles.framesGrid}
          renderItem={({ item, index }) => (
            <View style={styles.frameItem}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${item.video}` }}
                style={styles.frameImage}
                resizeMode="cover"
              />
              <Text style={styles.frameNumber}>#{index + 1}</Text>
              {index < 5 && (
                <View style={styles.preAlertBadge}>
                  <Text style={styles.preAlertBadgeText}>PRE</Text>
                </View>
              )}
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alert Recordings</Text>
        <Text style={styles.headerSubtitle}>
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {recordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📹</Text>
          <Text style={styles.emptyTitle}>No Recordings Yet</Text>
          <Text style={styles.emptyText}>
            When an alert is detected, the system will automatically record from 5 frames before 
            the alert until the alert clears.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.recordingCard, { borderLeftColor: getAlertColor(item.alertType) }]}
              onPress={() => setSelectedRecording(item)}
            >
              <View style={styles.recordingPreview}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${(item.frames[Math.floor(Math.random() * item.frames.length)] || item.frames[0]).video}` }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
                <View style={styles.frameBadge}>
                  <Text style={styles.frameBadgeText}>{item.frames.length}</Text>
                </View>
              </View>
              
              <View style={styles.recordingInfo}>
                <Text style={styles.alertType}>{item.alertType}</Text>
                <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
                <Text style={styles.duration}>
                  {(item.frames.length / 30).toFixed(1)}s recording
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => deleteRecording(item.id)}
                style={styles.deleteIconBtn}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1C1C1E',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    padding: 16,
  },
  recordingCard: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  recordingPreview: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  frameBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  frameBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  recordingInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  alertType: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  timestamp: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 4,
  },
  duration: {
    color: '#8E8E93',
    fontSize: 13,
  },
  deleteIconBtn: {
    padding: 12,
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#1C1C1E',
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  detailTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  detailTimestamp: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
  frameInfo: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  frameInfoText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  framesGrid: {
    padding: 8,
  },
  frameItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  frameImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2C2C2E',
  },
  frameNumber: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  preAlertBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF9500',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  preAlertBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  videoPlayer: {
    backgroundColor: '#000000',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
  },
  videoFrame: {
    width: '100%',
    height: 300,
    backgroundColor: '#1C1C1E',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1C1C1E',
  },
  playBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressInfo: {
    flex: 1,
    marginLeft: 16,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  timeText: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#2C2C2E',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
});
