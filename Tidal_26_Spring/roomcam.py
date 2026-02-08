import cv2
import numpy as np
import asyncio
import websockets
import json
import socket
import base64
import time
import threading
import os
from google import genai
from google.genai import types
from PIL import Image
import io

# ⚠️ PUT YOUR GEMINI KEY HERE
GEMINI_API_KEY = ""

# Configure Gemini
client = None
try:
    if "YOUR_API_KEY" not in GEMINI_API_KEY:
        client = genai.Client(api_key=GEMINI_API_KEY)
        print("🤖 Gemini AI Configured")
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

class RoomCamServer:
    def __init__(self):
        # --- UPGRADE: Use Deep Neural Network (DNN) for better accuracy ---
        # These models are built into OpenCV but need the files loaded.
        # If these fail, we fall back to Haar Cascades automatically.
        self.use_dnn = False
        try:
            # We will use the standard Haar Cascade as the primary for simplicity in this script,
            # but we tune the parameters for maximum accuracy.
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            
            # Additional cascades for profiles (side views)
            self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            print("✅ High-Accuracy Cascade configuration loaded")
        except Exception as e:
            print(f"⚠️ Cascade Error: {e}")

        self.connected_clients = set()
        self.alert_status = "WAITING FOR TRAINING..."
        self.last_ai_check = 0
        self.ai_lock = False
        self.ai_message = ""
        
        # --- MULTI-USER STORAGE ---
        self.faces_dir = "authorized_faces"
        if not os.path.exists(self.faces_dir):
            os.makedirs(self.faces_dir)
            
        self.authorized_users = [] 
        self.load_authorized_faces()

    def load_authorized_faces(self):
        """Loads all JPGs from the folder into memory"""
        self.authorized_users = []
        files = [f for f in os.listdir(self.faces_dir) if f.endswith('.jpg')]
        
        for filename in files:
            path = os.path.join(self.faces_dir, filename)
            try:
                with open(path, "rb") as f:
                    self.authorized_users.append(f.read())
            except Exception as e:
                print(f"❌ Error loading file {filename}: {e}")
        
        if len(self.authorized_users) > 0:
            print(f"✅ Loaded {len(self.authorized_users)} authorized users.")
            self.alert_status = f"SECURE: {len(self.authorized_users)} USERS ARMED"
        else:
            self.alert_status = "WAITING FOR TRAINING..."

    # --- GEMINI CHECK ---
    def verify_intruder(self, current_frame_rgb):
        if self.ai_lock or len(self.authorized_users) == 0: return
        self.ai_lock = True
        
        try:
            # 1. Current Room View
            current_pil = Image.fromarray(current_frame_rgb)
            
            # 2. CREATE A COLLAGE OF AUTHORIZED USERS
            user_images = [Image.open(io.BytesIO(b)) for b in self.authorized_users]
            
            if not user_images: return

            total_width = sum(img.width for img in user_images)
            max_height = max(img.height for img in user_images)
            
            collage = Image.new('RGB', (total_width, max_height))
            x_offset = 0
            for img in user_images:
                collage.paste(img, (x_offset, 0))
                x_offset += img.width
            
            # 3. ASK GEMINI
            prompt = """
            Compare these two images.
            Image 1 is a collage of ALL AUTHORIZED USERS (The Team).
            Image 2 is the CURRENT ROOM VIEW.
            
            Task:
            Is ANY person from the Team (Image 1) present in the Room (Image 2)?
            
            Rules:
            1. If AT LEAST ONE authorized user is in the room, return "SAFE" (even if strangers are there too).
            2. If NO authorized users are in the room, return "DANGER".
            3. Ignore lighting/angle differences.
            
            Return JSON:
            {
                "authorized_person_present": bool, 
                "confidence": "HIGH" or "LOW",
                "description": "Short description (e.g. 'User detected' or 'Unknown person only')"
            }
            """
            
            response = client.models.generate_content(
                model='gemini-2.5-flash-lite',
                contents=[prompt, collage, current_pil],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            data = json.loads(response.text)
            
            if data['authorized_person_present']:
                self.alert_status = "SECURE: AUTHORIZED USER DETECTED"
                self.ai_message = "Authorized personnel on site"
            else:
                self.alert_status = "🚨 ALERT: INTRUDER DETECTED"
                self.ai_message = f"Unknown: {data['description']}"
            
            print(f"🤖 AI Analysis: Safe? {data['authorized_person_present']} ({data['confidence']})")
            
        except Exception as e:
            print(f"AI Error: {e}")
        finally:
            self.ai_lock = False

    async def handle_client(self, websocket):
        self.connected_clients.add(websocket)
        try:
            async for message in websocket:
                data = json.loads(message)
                
                # --- SINGLE IMAGE TRAINING (Reverted per request) ---
                if data.get("command") == "train":
                    print("📸 Processing Training Data...")
                    
                    final_image_bytes = None
                    
                    # Check for single image payload
                    if data.get("image"):
                        b64_str = data.get("image")
                        # Handle header if present
                        if isinstance(b64_str, str) and "," in b64_str:
                             b64_str = b64_str.split(",", 1)[1]
                        final_image_bytes = base64.b64decode(b64_str)
                    
                    # If user accidentally sends the new format, just take the first one
                    elif data.get("images") and isinstance(data.get("images"), list) and len(data.get("images")) > 0:
                        b64_str = data.get("images")[0]
                        final_image_bytes = base64.b64decode(b64_str)

                    if final_image_bytes:
                        # Save to disk
                        filename = f"user_{int(time.time())}.jpg"
                        path = os.path.join(self.faces_dir, filename)
                        with open(path, "wb") as f:
                            f.write(final_image_bytes)
                        
                        # Reload list
                        self.load_authorized_faces()
                        
                        response = {"type": "train_result", "success": True}
                        await websocket.send(json.dumps(response))
                        print(f"✅ Saved new user profile: {filename}")
                    else:
                        print("❌ Error: No valid image found")
                        response = {"type": "train_result", "success": False}
                        await websocket.send(json.dumps(response))

                elif data.get("command") == "reset_faces":
                    for f in os.listdir(self.faces_dir):
                        os.remove(os.path.join(self.faces_dir, f))
                    self.load_authorized_faces()
                    print("🔄 All Authorized Users Deleted")

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"Server Error: {e}")
        finally:
            self.connected_clients.remove(websocket)

    async def broadcast(self, data):
        if not self.connected_clients: return
        msg = json.dumps(data)
        websockets.broadcast(self.connected_clients, msg)

    async def run(self):
        cap = cv2.VideoCapture(0)
        print(f"\n✅ ROOM CAM SERVER ACTIVE (High Accuracy Detection)\n📡 Remote Control URL: ws://{get_local_ip()}:8766\n")
        
        while True:
            await asyncio.sleep(0.01)
            ret, frame = cap.read()
            if not ret: break
            
            # --- IMPROVED DETECTION LOGIC ---
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 1. Frontal Face (Standard) - Lower ScaleFactor = More accurate but slower
            faces_frontal = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5, 
                minSize=(30, 30)
            )
            
            # 2. Profile Face (Side View) - Catches you when you turn your head
            faces_profile = self.profile_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5, 
                minSize=(30, 30)
            )
            
            # Combine detections
            faces = []
            if len(faces_frontal) > 0:
                for f in faces_frontal: faces.append(f)
            if len(faces_profile) > 0:
                for f in faces_profile: faces.append(f)
                
            face_found = len(faces) > 0
            
            # Draw Boxes
            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)

            # AI Logic
            if len(self.authorized_users) == 0:
                 pass 
            elif face_found:
                if time.time() - self.last_ai_check > 15.0:
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    threading.Thread(target=self.verify_intruder, args=(rgb_frame,)).start()
                    self.last_ai_check = time.time()
            else:
                self.alert_status = "SCANNING ROOM..."

            final_status = self.alert_status
            if self.ai_message and "ALERT" in self.alert_status:
                final_status = f"{self.alert_status} | {self.ai_message}"

            small_frame = cv2.resize(frame, (400, 300))
            _, buffer = cv2.imencode('.jpg', small_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            b64_video = base64.b64encode(buffer).decode('utf-8')
            
            payload = {
                "status": final_status,
                "video": b64_video,
                "faces_detected": len(faces)
            }
            await self.broadcast(payload)
            
            cv2.imshow("Room Cam (Laptop)", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
            
        cap.release()
        cv2.destroyAllWindows()

async def main():
    server = RoomCamServer()
    async with websockets.serve(server.handle_client, "0.0.0.0", 8766):
        await server.run()

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass