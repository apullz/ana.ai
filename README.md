# ANA.AI | Autonomous Neural Assistant

ANA.AI is a high-performance, multimodal intelligence interface that bridges the gap between cloud-scale reasoning and local edge inference. Designed for real-time collaboration, it allows users to interact with state-of-the-art AI models while sharing their screen and voice in a unified, sleek dashboard.

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/4696a39b-4636-42b8-95b0-01bb0158cd46" />


## 🚀 Core Features

### 1. Multimodal Live Session
- **Real-time Voice Conversation**: Powered by the Gemini 2.5 Flash Native Audio API for human-like, low-latency interaction.
- **Visual Awareness**: Integrated "Vision Link" screen capture allows the model to "see" what you are doing, provide real-time feedback, and answer questions about your current workflow.
- **Dynamic Visualization**: High-frequency audio meters track user and system speaking states with distinctive visual feedback.

### 2. Dual-Engine Intelligence
- **Cloud Engine**: Access **Gemini 2.5 Flash** for massive reasoning tasks and high-fidelity multimodal interaction.
- **Local Neural Core**: Run **Google Gemma 3 4B** directly in your browser using **Transformers.js** and **WebGPU/WASM**. No server required for local inference.

### 3. Specialized Intelligence Modules
- **Deep Video Understanding**: In-depth semantic analysis of video files using Gemini 3 Pro, including temporal markers and object identification.
- **Neural TTS**: High-fidelity text-to-speech synthesis with multiple prebuilt voice characters (Zephyr, Kore, Puck, etc.).

## 🛠 Installation & Setup

### Prerequisites
- **Node.js** (v18 or higher) installed on your machine.
- A **Google AI Studio API Key**.

### Step-by-Step Guide

#### 1. Get your API Key
You strictly need a valid API key from Google.
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Copy the key string.

#### 2. Install the App
Open your terminal/command prompt and run:

```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd ana-ai

# Install dependencies
npm install
```

#### 3. Configure Environment (Critical)
The application will not connect without the API key.
1. Create a new file in the root folder named `.env` (no extension).
2. Paste your API key inside it like this:

```env
API_KEY=your_actual_api_key_string_here
```

#### 4. Run the Application
Start the development server:

```bash
npm run dev
```
Then open your browser to the local URL provided (usually `http://localhost:5173`).

## ⚠️ Troubleshooting

**Issue: Screen share starts, but then immediately stops/cancels.**
*   **Cause:** This usually means the API Key is missing or invalid. The app attempts to connect to Gemini, fails authentication (Error 400/403), and automatically cleans up the video stream to reset the state.
*   **Fix:** Ensure your `.env` file exists in the root directory and contains a valid `API_KEY`.

**Issue: "Connection Failed" error.**
*   **Cause:** Network firewall or invalid model name.
*   **Fix:** Check your internet connection and ensure you are using the correct model names in the code (default is `gemini-2.5-flash-native-audio-preview-12-2025`).

## 🖥 Hardware Acceleration
ANA.AI automatically detects available hardware:
- **WebGPU**: Utilized for maximum performance during local model execution.
- **WASM Fallback**: Ensures compatibility on devices where GPU acceleration is unavailable.

## 🛡 Security & Privacy
- **Local First**: Screen capture data is streamed directly to the selected neural engine.
- **Encrypted Keys**: API keys are handled via environment variables and never stored on remote servers by the application.
- **Sandbox Execution**: Local models run entirely within the browser's origin sandbox.

---
*Built for the future of human-AI collaboration.*
