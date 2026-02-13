# ANA.AI | Autonomous Neural Assistant

ANA.AI is a high-performance, multimodal intelligence interface that bridges the gap between cloud-scale reasoning and local edge inference. Designed for real-time collaboration, it allows users to interact with state-of-the-art AI models while sharing their screen and voice in a unified, sleek dashboard.

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

### 4. Developer Control
- **Secure Auth Management**: Built-in developer settings for managing Hugging Face tokens and API keys via LocalStorage.
- **Neural Activity Log**: Detailed transcription history and system status telemetry.

## 🛠 Installation & Setup

### Prerequisites
- A modern browser with **WebGPU** support (Chrome/Edge recommended) for local model acceleration.
- A **Google AI Studio API Key**.
- (Optional) A **Hugging Face Access Token** for downloading gated models like Gemma 3.

### Steps
1. **Clone the Project**:
   ```bash
   git clone <repository-url>
   cd ana-ai
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file (or set in your environment):
   - `API_KEY`: Your Gemini API Key.
   - `NEXT_PUBLIC_HF_TOKEN`: Your Hugging Face token.

4. **Launch Application**:
   ```bash
   npm run dev
   ```

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