# Mamabear-Tidal-Spring-26

We Won Best Beginner at Tidal Hack 26' Spring. This is how we did it.

Inspiration
- New parents often face a difficult choice: buy expensive, wearable monitors that can irritate a baby's sensitive skin, or rely on "dumb" video monitors that just stream feed without insight. We wanted to build a middle ground, a Zero-Contact Guardian.

- We were inspired by Eulerian Video Magnification, a technique that can reveal invisible motions (like the pulse of blood in veins) just by analyzing standard video. We combined this biological signal processing with the reasoning power of Google Gemini to create MamaBear: a smart monitor that watches over health and home security without a single wire touching the baby.

What it does
- MamaBear is a dual-mode smart monitoring system:

Non-Invasive Health Tracking (The "Baby Cam"):
- Using computer vision, it detects the baby's face and isolates the skin (ROI).
- It amplifies subtle color changes caused by blood flow (rPPG) to estimate a heartbeat and breathing rate in real-time.
- If the vitals drop or motion stops, it triggers an alert.

Intelligent Intruder Detection (The "Room Cam"):
- It constantly scans the nursery for human faces using OpenCV Deep Neural Networks.
- If a face is detected, it captures a frame and sends it to Google Gemini.
- Gemini compares the intruder against a "Trusted Family" database (trained via the app) and decides if the person is an authorized parent or a stranger.
- If it's a stranger, the app flashes a RED ALERT.

Remote Control App:
- A React Native app acts as the command center. You can view live feeds, see health stats, and even "Train" the AI by taking a selfie on your phone to add yourself to the authorized user list.

How we built it:
- The Core: Written in Python, leveraging OpenCV for heavy image processing and NumPy for signal FFT analysis.
- The AI Brain: We used Google Gemini 2.5 Flash Lite. Instead of relying on brittle local face matching algorithms, we simply ask Gemini: "Is the person in Image A present in the room in Image B?" This allows for robust detection even with different lighting or angles.
- The Frontend: Built with React Native (Expo). It connects to the Python backend via WebSockets, receiving Base64 video streams and sending control commands (like "Train Face").
- Connectivity: We used Cloudflare Tunnels to expose our local Python servers to the internet securely, allowing the app to work from anywhere, not just local Wi-Fi.

Challenges we ran into:
- The "dlib" Nightmare: We initially tried to use the standard face_recognition library, but installing C++ dependencies on Windows was a massive roadblock. We pivoted to a Hybrid AI approach: using OpenCV for fast detection (finding where a face is) and Gemini for recognition (finding who it is). This turned out to be more robust!
- Latency vs. Quality: Streaming raw video over WebSockets caused massive lag. We had to implement frame compression and threading to ensure the video feed remained real-time while the heavy AI analysis ran in the background.
- Rate Limits: We kept hitting the 429 Resource Exhausted error with the Gemini API. We solved this by implementing a "smart throttle" that only queries the AI when a human face is actually detected, and limiting checks to once every 15 seconds.
- Accomplishments that we're proud of
- Zero-Hardware Pulse: Successfully implementing a heartbeat monitor that requires no wearables. It feels like magic to see a pulse graph generated just from a webcam feed.
- Seamless "Remote Training": We built a workflow where you can take a selfie on your phone, send it instantly to the laptop, and have the security system update its authorized database in real-time.
- Cross-Platform Sync: Getting a Python script on Windows to talk perfectly to a React Native app on iOS via a secure tunnel.

What we learned:
- Generative AI as a Judge: LLMs/VLMs aren't just for generating text; they are excellent qualitative judges for security scenarios (e.g., distinguishing between a parent holding a baby vs. a stranger).
- Signal Processing is Hard: Extracting a heartbeat from a video requires filtering out a lot of noise (lighting changes, baby movement).
- The Power of WebSockets: HTTP requests are too slow for real-time video; persistent socket connections are essential for live interactions.

What's next for MamaBear:
- Cry Analysis: Integrating audio processing to distinguish between a "hungry cry," a "pain cry," and simple fussing.
- Edge Deployment: Moving the Python backend from a laptop to a Raspberry Pi 5 or NVIDIA Jetson to make it a standalone hardware product.

Built With:
- base64
- cloudflared
- gemini
- gen-ai
- javascript
- node.js
- numpy
- opencv2
- python
- react-native
- react-native-chart-kit
- tsx
- websocket
