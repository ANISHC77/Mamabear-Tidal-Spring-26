import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, SafeAreaView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// ⚠️ REPLACE WITH YOUR PYTHON SERVER IP
const SERVER_IP = '10.246.255.37';
const WS_URL = `ws://${SERVER_IP}:8766`;

export default function RoomCam() {
  // --- STATE ---
  const [permission, requestPermission] = useCameraPermissions();
  const [isConnected, setIsConnected] = useState(false);
  
  // LIVE FEED STATE (From Laptop)
  const [laptopStream, setLaptopStream] = useState(null); 
  const [status, setStatus] = useState("CONNECTING...");
  const [faceCount, setFaceCount] = useState(0);
  
  // TRAINING STATE (On Phone)
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const ws = useRef(null);
  const phoneCameraRef = useRef(null);

  // --- 1. WEBSOCKET CONNECTION ---
  useEffect(() => {
    connectWebSocket();
    return () => { if (ws.current) ws.current.close(); };
  }, [connectWebSocket]);

  const connectWebSocket = useCallback(() => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      setIsConnected(true);
      setStatus("CONNECTED");
      console.log("✅ Connected to Room Cam Server");
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      
      // A. Receive Live Video FROM Laptop
      if (data.video) {
        setLaptopStream(data.video); 
        setStatus(data.status);
        setFaceCount(data.faces_detected);
      }
      
      // B. Receive Training Confirmation FROM Laptop
      if (data.type === "train_result") {
        setIsSending(false);
        resetTraining();
        if (data.success) {
            Alert.alert("System Armed", "Laptop has learned your face from all angles.");
            setIsTrainingMode(false); // Close phone camera, go back to stream
        } else {
          Alert.alert("Training Failed", "Please try again.");
        }
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setStatus("DISCONNECTED");
      setTimeout(connectWebSocket, 2000); // Auto-reconnect
    };

    ws.current.onerror = (error) => {
      setStatus("CONNECTION ERROR");
    };
  }, []);

  const resetTraining = () => {
    setIsSending(false);
  };

  // --- 2. TRAINING: Phone takes photo -> Sends to Laptop ---
  const sendTrainingPhoto = async () => {
    if (phoneCameraRef.current && !isSending) {
      try {
        setIsSending(true);
        // 1. Capture Image on Phone
        const photo = await phoneCameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });

        // 2. Send to server immediately
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            command: "train",
            image: photo.base64
          }));
          console.log("✅ Training photo sent to server");
          
          // Close training mode
          setIsSending(false);
          setIsTrainingMode(false);
          resetTraining();
        } else {
          console.log("❌ WebSocket not ready. State:", ws.current?.readyState);
          Alert.alert("Error", "Not connected to laptop. Please check connection.");
          setIsSending(false);
        }
      } catch (error) {
        Alert.alert("Camera Error", error.message);
        setIsSending(false);
      }
    }
  };

  const handleResetFaces = () => {
    if (ws.current) ws.current.send(JSON.stringify({ command: "reset_faces" }));
  };

  // --- 3. UI RENDERING ---

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera permission to train your face for baby monitoring security.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
            <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // B. LIVE MONITOR UI
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[
        styles.statusBanner,
        { backgroundColor: status.includes("ALERT") ? '#FF3B30' : status.includes("SECURE") ? '#34C759' : '#8E8E93' }
      ]}>
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.subStatus}>
          {isConnected ? `Monitoring Room (${faceCount} faces)` : "Connecting to Laptop..."}
        </Text>
      </View>

      {/* VIDEO STREAM */}
      <View style={styles.videoContainer}>
        {laptopStream ? (
          <Image
            style={styles.video}
            source={{ uri: `data:image/jpeg;base64,${laptopStream}` }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#34C759" />
            <Text style={styles.loadingText}>Waiting for Laptop Feed...</Text>
          </View>
        )}
      </View>

      {/* CONTROLS */}
      <View style={styles.footer}>
        <Text style={styles.infoText}>Faces Detected: {faceCount}</Text>

        <View style={styles.row}>
            <TouchableOpacity style={styles.trainBtn} onPress={() => {
              resetTraining();
              setIsTrainingMode(true);
            }}>
            <Text style={styles.btnText}>📸 TRAIN FACE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetFaces}>
            <Text style={styles.btnText}>🔄 RESET</Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* TRAINING MODAL */}
      <Modal visible={isTrainingMode} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <CameraView style={styles.modalCamera} ref={phoneCameraRef} facing="front">
            {/* Header Section */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>TRAINING MODE</Text>
              <Text style={styles.modalSubtitle}>
                Take a clear photo of your face looking at the camera
              </Text>
            </View>

            {/* Bottom Controls */}
            <View style={styles.modalControls}>
              {isSending ? (
                <View style={styles.captureContainer}>
                  <ActivityIndicator size="large" color="#34C759" />
                  <Text style={styles.sendingText}>Sending photo...</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.modalCaptureBtn} onPress={sendTrainingPhoto}>
                  <View style={styles.modalCaptureInner} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => {
                setIsTrainingMode(false);
                resetTraining();
              }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },

  // Video View
  statusBanner: { padding: 15, paddingTop: 50, alignItems: 'center' },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  videoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  loading: { alignItems: 'center' },

  // Footer
  footer: { padding: 20, alignItems: 'center' },
  infoText: { color: '#aaa', marginBottom: 15 },
  row: { flexDirection: 'row', gap: 20 },
  trainBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, width: 150, alignItems: 'center' },
  resetBtn: { backgroundColor: '#444', padding: 15, borderRadius: 10, width: 100, alignItems: 'center' },

  // Camera Training View
  camera: { flex: 1 },
  overlay: { paddingTop: 60, paddingHorizontal: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  headerText: { color: '#00ff00', fontSize: 24, fontWeight: 'bold' },
  subText: { color: 'white', fontSize: 18, marginTop: 5 },
  instructionText: { color: '#ddd', textAlign: 'center', marginTop: 10 },

  controls: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-around' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  captureBtnDisabled: { opacity: 0.6 },
  captureInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'black' },
  closeBtn: { backgroundColor: 'rgba(255,0,0,0.8)', padding: 15, borderRadius: 10 },

  btnText: { color: 'white', fontWeight: 'bold' },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginTop: 20 },

  // Additional styles
  subStatus: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 5,
    fontWeight: '500'
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 10,
    fontSize: 15
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalCamera: {
    flex: 1,
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#34C759',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
    maxWidth: 300,
  },
  modalControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  captureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sendingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  modalCaptureBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 20,
  },
  modalCaptureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  modalCancelBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 3,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});