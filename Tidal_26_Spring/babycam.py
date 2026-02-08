import cv2
import numpy as np
from scipy import signal
import time
import asyncio
import websockets
import json
import socket
import base64
import sounddevice as sd
import threading
from PIL import Image
from google import genai
from google.genai import types

# ⚠️ PUT YOUR KEY HERE
GEMINI_API_KEY = ""

# Configure Gemini
GEMINI_AVAILABLE = False
client = None
try:
    if "YOUR_API_KEY" not in GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
        GEMINI_AVAILABLE = True
        print("🤖 Gemini AI Configured Successfully")
    else:
        print("⚠️ Gemini Key Missing")
except Exception as e:
    print(f"⚠️ Gemini Error: {e}")

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class AudioMonitor:
    def __init__(self, threshold=25.0): 
        self.threshold = threshold
        self.is_loud = False
        self.running = True
        self.loud_frames = 0
        self.audio_buffer = []
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._listen, daemon=True)
        self.thread.start()

    def get_audio_chunk(self):
        with self.lock:
            if not self.audio_buffer:
                return ""
            data = b''.join(self.audio_buffer)
            self.audio_buffer.clear()
            return base64.b64encode(data).decode('utf-8')

    def _listen(self):
        def callback(indata, frames, time, status):
            volume_norm = np.linalg.norm(indata) * 50
            if volume_norm > self.threshold:
                self.loud_frames += 1
            else:
                self.loud_frames = max(0, self.loud_frames - 1)
            
            if self.loud_frames > 5:
                self.is_loud = True
            else:
                self.is_loud = False
            
            # Capture audio: Convert float32 to int16 PCM
            pcm_data = (indata * 32767).clip(-32768, 32767).astype(np.int16).tobytes()
            with self.lock:
                self.audio_buffer.append(pcm_data)

        with sd.InputStream(callback=callback, channels=1, samplerate=16000, blocksize=1600):
            while self.running:
                sd.sleep(100)
    
    def stop(self):
        self.running = False

class Stabilizer:
    def __init__(self, decay=0.9, threshold=5):
        self.value = 0
        self.decay = decay
        self.threshold = threshold
    
    def update(self, new_val):
        if new_val == 0: return self.value
        if self.value == 0:
            self.value = new_val
            return self.value
        change = new_val - self.value
        if abs(change) > self.threshold:
            new_val = self.value + (self.threshold * (1 if change > 0 else -1))
        self.value = (self.value * self.decay) + (new_val * (1 - self.decay))
        return self.value

class NannyCamServer:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        self.hr_stabilizer = Stabilizer(decay=0.96, threshold=2.0)
        self.rr_stabilizer = Stabilizer(decay=0.85, threshold=1.0) 
        
        self.hr_buffer = [] 
        self.hr_times = []
        
        self.lk_params = dict(winSize=(15, 15), maxLevel=2, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03))
        self.old_gray = None
        self.p0_chest = None
        self.resp_buffer = [] 
        
        self.bad_tracking_frames = 0
        self.connected_clients = set()
        
        print("🎙️ Initializing Audio...")
        self.audio_monitor = AudioMonitor(threshold=25.0)

        self.last_face_time = time.time()
        self.is_rolled_over = False
        
        # GEMINI STATE
        self.gemini_status = None
        self.gemini_last_update = 0 # Timestamp of last AI response
        self.last_gemini_check = 0
        self.gemini_lock = False

    def detect_faces_robust(self, gray):
        # 1. Try Upright Frontal
        faces = list(self.face_cascade.detectMultiScale(gray, 1.3, 5))
        if len(faces) > 0: return faces, "upright"
        
        # 2. Try Upright Profile
        faces = list(self.profile_cascade.detectMultiScale(gray, 1.3, 5))
        if len(faces) > 0: return faces, "upright" # Treat profile like upright for tracking
        
        # 3. Try Profile Flipped (looking other way)
        flipped = cv2.flip(gray, 1)
        faces = list(self.profile_cascade.detectMultiScale(flipped, 1.3, 5))
        if len(faces) > 0: return faces, "flipped" # Don't track, coords are flipped
        
        # 4. Try 90 Rotations (Sideways Sleeping)
        for output_tag, code in [("90", cv2.ROTATE_90_CLOCKWISE), ("270", cv2.ROTATE_90_COUNTERCLOCKWISE), ("180", cv2.ROTATE_180)]:
            rotated = cv2.rotate(gray, code)
            faces = list(self.face_cascade.detectMultiScale(rotated, 1.3, 5))
            if len(faces) > 0: return faces, output_tag

        return [], "none"

    async def register_client(self, websocket):
        self.connected_clients.add(websocket)
        try:
            await websocket.wait_closed()
        finally:
            self.connected_clients.remove(websocket)

    async def broadcast_data(self, data):
        if not self.connected_clients: return
        message = json.dumps(data)
        websockets.broadcast(self.connected_clients, message)
    
    # --- GEMINI WORKER ---
    def check_with_gemini(self, frame_bgr):
        if self.gemini_lock or not GEMINI_AVAILABLE: return
        self.gemini_lock = True
        
        try:
            rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_frame)
            
            prompt = """
            Analyze this baby monitor frame. Return JSON:
            {"is_safe": bool, "status_text": "string (MAX 3 WORDS)", "is_crying": bool}
            Examples: "SAFE", "ON STOMACH", "CRYING", "FACE COVERED".
            """
            
            response = client.models.generate_content(
                model='gemini-2.5-flash-lite',
                contents=[prompt, pil_img],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            data = json.loads(response.text)
            
            # UPDATED LOGIC: Even "Safe" is a status now
            if not data['is_safe']:
                self.gemini_status = f"AI ALERT: {data['status_text'].upper()}"
            elif data['is_crying']:
                self.gemini_status = "AI ALERT: CRYING"
            else:
                self.gemini_status = "AI: SAFE" 
            
            self.gemini_last_update = time.time()
            print(f"🤖 AI Check: {self.gemini_status}")
            
        except Exception as e:
            print(f"Gemini logic error: {e}")
        finally:
            self.gemini_lock = False

    # --- SIGNAL PROCESSING ---
    def get_bpm_fft(self, signal_data, times):
        if len(signal_data) < 30: return 0
        fps_val = len(times) / (times[-1] - times[0])
        y = signal.detrend(np.array(signal_data))
        nyquist = fps_val / 2
        low = 0.75; high = 3.0 
        if low >= nyquist: return 0
        b, a = signal.butter(4, [low/nyquist, min(high/nyquist, 0.99)], btype='band')
        filtered = signal.filtfilt(b, a, y)
        fft_mag = np.abs(np.fft.rfft(filtered))
        peak_idx = np.argmax(fft_mag)
        freqs = np.fft.rfftfreq(len(filtered), d=1/fps_val)
        return freqs[peak_idx] * 60

    def get_rpm_peak_counting(self, wave_data, times):
        if len(wave_data) < 30: return 0
        y = np.array(wave_data)
        y = signal.detrend(y)
        kernel = np.ones(5)/5 
        y_smooth = np.convolve(y, kernel, mode='same')
        range_val = np.max(y_smooth) - np.min(y_smooth)
        if range_val < 1e-5: return 0
        y_norm = (y_smooth - np.min(y_smooth)) / range_val
        peaks, _ = signal.find_peaks(y_norm, distance=15, prominence=0.05)
        duration = times[-1] - times[0]
        if duration > 0:
            rpm = (len(peaks) / duration) * 60
            return min(rpm, 80)
        return 0

    async def run(self):
        cap = cv2.VideoCapture(0)
        print(f"\n✅ SERVER STARTED!\n📡 Connect App to: ws://{get_local_ip()}:8765\n")
        
        while True:
            await asyncio.sleep(0.1) # Limit to ~10 FPS
            ret, frame = cap.read()
            if not ret: break
            
            clean_frame = frame.copy()
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            h, w, _ = frame.shape
            
            # --- FACE DETECTION (Robust) ---
            all_faces, orientation = self.detect_faces_robust(gray)
            
            faces = []
            if len(all_faces) > 0:
                faces = all_faces if orientation == "upright" else []
            
            # --- AI CHECK (Every 5s) ---
            if time.time() - self.last_gemini_check > 10.0:
                threading.Thread(target=self.check_with_gemini, args=(clean_frame,)).start()
                self.last_gemini_check = time.time()

            # --- ROLL LOGIC ---
            if len(all_faces) > 0:
                self.last_face_time = time.time()
                self.is_rolled_over = False
            
            time_since_face = time.time() - self.last_face_time
            if time_since_face > 3.0 and self.p0_chest is not None and len(self.p0_chest) > 5:
                self.is_rolled_over = True
            
            raw_hr = 0; raw_rr = 0
            status = "SEARCHING..."
            if self.is_rolled_over: status = "ALERT: ROLLED OVER"
            
            chest_detected = False; thrashing_detected = False
            
            if len(faces) > 0:
                status = "SAFE"
                (x, y, w_f, h_f) = max(faces, key=lambda f: f[2] * f[3])
                
                fh_x = x + int(w_f * 0.5) - 20; fh_y = y + int(h_f * 0.15)
                roi = frame[fh_y:fh_y+30, fh_x:fh_x+40]
                cv2.rectangle(frame, (fh_x, fh_y), (fh_x+40, fh_y+30), (0, 255, 0), 2)
                if roi.size > 0:
                    self.hr_buffer.append(np.mean(roi[:, :, 1]))
                    self.hr_times.append(time.time())

                chest_top = y + h_f; chest_bottom = min(h, chest_top + 150)
                chest_left = x + int(w_f * 0.2); chest_right = x + int(w_f * 0.8)
                
                if self.p0_chest is None:
                    mask = np.zeros_like(gray)
                    cv2.rectangle(mask, (chest_left, chest_top), (chest_right, chest_bottom), 255, -1)
                    self.p0_chest = cv2.goodFeaturesToTrack(gray, mask=mask, maxCorners=20, qualityLevel=0.01, minDistance=10, blockSize=7)
                    self.old_gray = gray.copy()
                    self.resp_buffer = [] 
                elif len(self.p0_chest) < 5:
                    mask = np.zeros_like(gray)
                    cv2.rectangle(mask, (chest_left, chest_top), (chest_right, chest_bottom), 255, -1)
                    new_pts = cv2.goodFeaturesToTrack(gray, mask=mask, maxCorners=20 - len(self.p0_chest), qualityLevel=0.01, minDistance=10, blockSize=7)
                    if new_pts is not None: self.p0_chest = np.concatenate((self.p0_chest, new_pts), axis=0)

                if self.p0_chest is not None:
                    chest_detected = True
                    p1, st, err = cv2.calcOpticalFlowPyrLK(self.old_gray, gray, self.p0_chest, None, **self.lk_params)
                    if p1 is not None:
                        good_new = []; good_old = []; movements = []
                        for i, (new_pt, old_pt) in enumerate(zip(p1[st==1], self.p0_chest[st==1])):
                             a, b = new_pt.ravel(); c, d = old_pt.ravel()
                             if chest_left <= a <= chest_right and chest_top <= b <= chest_bottom:
                                 good_new.append(new_pt); good_old.append(old_pt)
                                 movements.append(np.sqrt((a-c)**2 + (b-d)**2))
                        
                        good_new = np.array(good_new).reshape(-1, 1, 2)
                        good_old = np.array(good_old).reshape(-1, 1, 2)

                        if len(good_new) > 0:
                            dy = np.mean(good_new[:, 0, 1] - good_old[:, 0, 1])
                            val = self.resp_buffer[-1] if self.resp_buffer else 0
                            self.resp_buffer.append(val + dy)
                            
                            if np.mean(movements) > 2.0: thrashing_detected = True
                            
                            color = (0, 0, 255) if thrashing_detected else (0, 255, 255)
                            for pt in good_new: cv2.circle(frame, (int(pt.ravel()[0]), int(pt.ravel()[1])), 3, color, -1)

                            self.p0_chest = good_new
                            self.old_gray = gray.copy()
                        else: self.p0_chest = None
                    else: self.p0_chest = None
            
            if len(self.hr_buffer) > 150: self.hr_buffer.pop(0); self.hr_times.pop(0)
            if len(self.resp_buffer) > 150: self.resp_buffer.pop(0)

            if len(self.hr_buffer) > 60: raw_hr = self.get_bpm_fft(self.hr_buffer, self.hr_times)
            if len(self.resp_buffer) > 60: raw_rr = self.get_rpm_peak_counting(self.resp_buffer, self.hr_times[-len(self.resp_buffer):])
                
            stable_hr = self.hr_stabilizer.update(raw_hr)
            stable_rr = self.rr_stabilizer.update(raw_rr)

            # --- FINAL STATUS LOGIC (Priority Order: 1. Crying, 2. Rolled, 3. Breath, 4. Gemini) ---
            
            # Priority 4: Gemini AI (Lowest priority of the intelligent/alert statuses)
            if self.gemini_status and (time.time() - self.gemini_last_update < 6.0):
                status = self.gemini_status

            # Priority 3: Breathing Alerts
            if stable_rr > 40: 
                status = "ALERT: FAST BREATH"
            elif stable_rr < 5 and stable_rr > 0: 
                status = "ALERT: LOW BREATH"
            
            # Priority 2: Rolled Over
            if self.is_rolled_over: 
                status = "ALERT: ROLLED OVER"
            
            # Priority 1: Crying / Loud Noise (Highest Priority)
            audio_alert = self.audio_monitor.is_loud
            if audio_alert:
                if thrashing_detected: 
                    status = "ALERT: CRYING DETECTED"
                else: 
                    status = "ALERT: LOUD NOISE"
            
            # Payload
            small_frame = cv2.resize(clean_frame, (400, 300))
            
            # Payload
            small_frame = cv2.resize(clean_frame, (400, 300))
            _, buffer = cv2.imencode('.jpg', small_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            b64_video = base64.b64encode(buffer).decode('utf-8')

            hr_graph = [float(val) for val in self.hr_buffer[-60:]]
            rr_graph = [float(val) for val in self.resp_buffer[-60:]]
            
            payload = {
                "type": "video",
                "bpm": int(stable_hr), "rpm": int(stable_rr), "status": status,
                "video": b64_video, "hr_wave": hr_graph, "rr_wave": rr_graph
            }
            
            await self.broadcast_data(payload)
            cv2.imshow("NannyCam Server", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
            
        cap.release()
        cv2.destroyAllWindows()
        self.audio_monitor.stop()

    async def broadcast_audio(self):
        print("🎙️ Audio Stream Started")
        while True:
            await asyncio.sleep(0.05)
            chunk = self.audio_monitor.get_audio_chunk()
            if chunk:
                payload = {"type": "audio", "audio": chunk}
                await self.broadcast_data(payload)

async def main():
    server = NannyCamServer()
    print("🚀 Starting NannyCam...")
    async with websockets.serve(server.register_client, "0.0.0.0", 8765):
        await asyncio.gather(
            server.run(),
            server.broadcast_audio()
        )

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass