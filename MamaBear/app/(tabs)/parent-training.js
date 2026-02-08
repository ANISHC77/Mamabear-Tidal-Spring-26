import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// ⚠️ REPLACE WITH YOUR PYTHON SERVER IP
const SERVER_IP = '10.246.255.37';
const WS_URL = `ws://${SERVER_IP}:8766`; // Port 8766 for Room Cam

export default function RoomCam() {
  // --- STATE ---
  const [permission, requestPermission] = useCameraPermissions();
  const [isConnected, setIsConnected] = useState(false);
  const [serverImage, setServerImage] = useState(null); // The video stream from Python
  const [status, setStatus] = useState("CONNECTING...");
  const [faceCount, setFaceCount] = useState(0);

  // Training Mode State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingCount, setTrainingCount] = useState(0);

  // Refs
  const ws = useRef(null);
  const cameraRef = useRef(null);

  // --- 1. WEBSOCKET CONNECTION ---
  useEffect(() => {
    connectWebSocket();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  const connectWebSocket = () => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      setIsConnected(true);
      setStatus("CONNECTED");
      console.log("✅ Connected to Room Cam Server");
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // If receiving video feed
      if (data.video) {
        setServerImage(data.video);
        setStatus(data.status);
        setFaceCount(data.faces_detected);
      }

      // If receiving training confirmation
      if (data.type === "train_result") {
        if (data.success) {
          Alert.alert("Success", "Face learned! Take another angle.");
          setTrainingCount(prev => prev + 1);
        } else {
          Alert.alert("Error", "Could not find face in photo. Try again.");
        }
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setStatus("DISCONNECTED");
      setTimeout(connectWebSocket, 2000); // Auto-reconnect
    };
  };

  // --- 2. TRAINING LOGIC ---
  const takeTrainingPhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true, // We need the Base64 string to send to Python
        });

        if (ws.current && isConnected) {
          // Send to Python Server
          const payload = {
            command: "train",
            image: photo.base64
          };
          ws.current.send(JSON.stringify(payload));
        }
      } catch (error) {
        Alert.alert("Camera Error", error.message);
      }
    }
  };

  const handleResetFaces = () => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ command: "reset_faces" }));
      setTrainingCount(0);
      Alert.alert("Reset", "All faces cleared. You are now an intruder.");
    }
  };

  // --- 3. UI RENDERING ---

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{color:'white'}}>We need camera permission to train your face.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // A. TRAINING MODE UI
  if (isTraining) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} ref={cameraRef} facing="front">
          <View style={styles.overlay}>
            <Text style={styles.headerText}>TRAINING MODE</Text>
            <Text style={styles.subText}>Photos Taken: {trainingCount}</Text>
            <Text style={styles.instructionText}>
              Take 5-10 photos from different angles (front, side, up, down).
            </Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.captureBtn} onPress={takeTrainingPhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsTraining(false)}>
              <Text style={styles.btnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // B. LIVE MONITOR UI
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[
        styles.statusBanner,
        { backgroundColor: status.includes("ALERT") ? 'red' : status.includes("SECURE") ? 'green' : '#333' }
      ]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {/* VIDEO STREAM */}
      <View style={styles.videoContainer}>
        {serverImage ? (
          <Image
            style={styles.video}
            source={{ uri: `data:image/jpeg;base64,${serverImage}` }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#00ff00" />
            <Text style={{color:'white', marginTop:10}}>Waiting for Server...</Text>
          </View>
        )}
      </View>

      {/* CONTROLS */}
      <View style={styles.footer}>
        <Text style={styles.infoText}>Faces Detected: {faceCount}</Text>

        <View style={styles.row}>
            <TouchableOpacity style={styles.trainBtn} onPress={() => setIsTraining(true)}>
            <Text style={styles.btnText}>📸 TRAIN FACE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleResetFaces}>
            <Text style={styles.btnText}>🔄 RESET</Text>
            </TouchableOpacity>
        </View>
      </View>
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
  captureInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'black' },
  closeBtn: { backgroundColor: 'rgba(255,0,0,0.8)', padding: 15, borderRadius: 10 },

  btnText: { color: 'white', fontWeight: 'bold' },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginTop: 20 },
});