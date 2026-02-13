
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { pipeline, env } from '@huggingface/transformers';
import { encode, decode, decodeAudioData } from '../utils/audio-utils';
import { TranscriptionEntry, ModelID } from '../types';
import { MODELS } from './Layout';

// Transformers configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

interface LiveSessionProps {
  activeModelId: ModelID;
}

const LiveSession: React.FC<LiveSessionProps> = ({ activeModelId }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  
  // Volume state for visualization
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  const activeModel = MODELS.find(m => m.id === activeModelId)!;

  // Local Pipeline Refs
  const localLLMRef = useRef<any>(null);
  const localSTTRef = useRef<any>(null);
  const localVisionRef = useRef<any>(null);

  // Gemini Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Analysis Refs
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // General Media Refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Transcription Buffers
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const addLog = useCallback((role: 'user' | 'model', text: string) => {
    if (!text || !text.trim()) return;
    setTranscriptions(prev => [...prev, { role, text: text.trim(), timestamp: Date.now() }]);
  }, []);

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    
    setIsActive(false);
    setIsScreenShared(false);
    sessionPromiseRef.current = null;
    setInputLevel(0);
    setOutputLevel(0);
  }, []);

  const updateVolumes = useCallback(() => {
    if (inputAnalyserRef.current) {
      const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setInputLevel(average);
    }
    if (outputAnalyserRef.current) {
      const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      outputAnalyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setOutputLevel(average);
    }
    animationFrameRef.current = requestAnimationFrame(updateVolumes);
  }, []);

  // Initialize Local Models
  const initLocalModels = async () => {
    if (activeModel.provider !== 'local') return;
    setIsLocalLoading(true);
    setLoadProgress(5);
    try {
      if (!localSTTRef.current) {
        localSTTRef.current = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
          progress_callback: (p: any) => p.status === 'progress' && setLoadProgress(5 + p.progress * 0.15)
        });
      }
      
      if (!localVisionRef.current) {
        localVisionRef.current = await pipeline('image-to-text', 'onnx-community/vit-gpt2-image-captioning', {
          progress_callback: (p: any) => p.status === 'progress' && setLoadProgress(20 + p.progress * 0.2)
        });
      }

      // Using Gemma 3 4B
      localLLMRef.current = await pipeline('text-generation', activeModel.huggingFaceId!, {
        dtype: 'q4', // Quantization for performance
        progress_callback: (p: any) => p.status === 'progress' && setLoadProgress(40 + p.progress * 0.6)
      });
      
      setLoadProgress(100);
      setIsLocalLoading(false);
    } catch (err) {
      console.error('Local model initialization error:', err);
      setIsLocalLoading(false);
    }
  };

  useEffect(() => {
    if (activeModel.provider === 'local') {
      initLocalModels();
    }
  }, [activeModelId]);

  const handleStartSession = async () => {
    if (activeModel.provider === 'local') {
      setIsActive(true);
      return;
    }

    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // Setup Analyzers
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;

      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;
      outputAnalyser.connect(outputCtx.destination);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(micStream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            source.connect(inputAnalyser);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const fromRate = e.inputBuffer.sampleRate;
              const ratio = fromRate / 16000;
              const newLength = Math.floor(inputData.length / ratio);
              const int16 = new Int16Array(newLength);
              for (let i = 0; i < newLength; i++) {
                int16[i] = inputData[Math.floor(i * ratio)] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            
            updateVolumes();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioCtxRef.current && outputAnalyserRef.current) {
              const ctx = outputAudioCtxRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAnalyserRef.current);
              source.addEventListener('ended', () => activeSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              activeSourcesRef.current.add(source);
            }
            if (message.serverContent?.inputTranscription) currentInputTransRef.current += message.serverContent.inputTranscription.text;
            if (message.serverContent?.outputTranscription) currentOutputTransRef.current += message.serverContent.outputTranscription.text;
            if (message.serverContent?.turnComplete) {
              addLog('user', currentInputTransRef.current);
              addLog('model', currentOutputTransRef.current);
              currentInputTransRef.current = '';
              currentOutputTransRef.current = '';
            }
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => cleanup(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are ANA.AI, a high-performance assistant. Use the shared screen content to provide intelligent and relevant feedback. Respond conversationally and concisely.',
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error('Session failed:', err);
      cleanup();
    }
  };

  const handleShareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { frameRate: 15, cursor: 'always' } as any, 
        audio: false 
      });
      screenStreamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      setIsScreenShared(true);
      stream.getTracks()[0].onended = () => cleanup();

      if (activeModel.provider === 'google') {
        const sessionPromise = sessionPromiseRef.current;
        frameIntervalRef.current = window.setInterval(async () => {
          if (!videoPreviewRef.current || !sessionPromise || !canvasRef.current) return;
          const video = videoPreviewRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx || video.videoWidth === 0) return;

          const scale = Math.min(1, 1024 / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(async (blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => {
                const base64Data = (reader.result as string).split(',')[1];
                sessionPromise.then((session: any) => {
                  session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                }).catch(() => {});
              };
            }
          }, 'image/jpeg', 0.6);
        }, 1500);
      }
    } catch (err) {
      console.error('Screen share error:', err);
      setIsScreenShared(false);
    }
  };

  useEffect(() => {
    if (isScreenShared && screenStreamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenShared]);

  // Derived visibility state
  const isUserSpeaking = inputLevel > 15;
  const isModelSpeaking = outputLevel > 15;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
            {activeModel.name.toUpperCase()}
            <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">V1.2</span>
          </h2>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">
            {activeModel.provider === 'google' ? 'Cloud Multimodal Engine' : 'Edge Inference Unit'}
          </p>
        </div>

        <div className="flex gap-3">
          {isLocalLoading ? (
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-slate-500 font-bold mb-1 uppercase tracking-tighter">Syncing Neural Weights</span>
              <div className="w-48 bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${loadProgress}%` }}></div>
              </div>
            </div>
          ) : !isActive ? (
            <button
              onClick={handleStartSession}
              className={`px-6 py-2 rounded text-[10px] font-black uppercase transition-all active:scale-95 border ${
                activeModel.provider === 'google' 
                  ? 'bg-cyan-600 border-cyan-500 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                  : 'bg-purple-600 border-purple-500 hover:bg-purple-500 text-white'
              }`}
            >
              Initialize {activeModel.name.split(' ')[0]}
            </button>
          ) : (
            <button
              onClick={cleanup}
              className="px-4 py-2 bg-red-950/20 border border-red-900 text-red-500 rounded text-[10px] font-black uppercase hover:bg-red-900 hover:text-white transition-all"
            >
              Terminate
            </button>
          )}
          {isActive && !isScreenShared && (
            <button
              onClick={handleShareScreen}
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded text-[10px] font-black uppercase hover:border-slate-400 transition-all flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Vision Link
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 bg-black/40 rounded-xl border border-slate-800/50 relative overflow-hidden flex flex-col group shadow-inner">
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`} />
              <span className="text-[9px] font-black text-white tracking-widest uppercase">{isActive ? 'Session_Live' : 'System_Idle'}</span>
            </div>
            {isUserSpeaking && (
              <div className="flex items-center gap-2 bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded border border-blue-500/40 animate-pulse">
                <div className="w-1 h-1 bg-blue-400 rounded-full" />
                <span className="text-[8px] font-black text-blue-300 tracking-widest uppercase">Operator_Speaking</span>
              </div>
            )}
            {isModelSpeaking && (
              <div className="flex items-center gap-2 bg-cyan-500/20 backdrop-blur-md px-3 py-1 rounded border border-cyan-500/40 animate-pulse">
                <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                <span className="text-[8px] font-black text-cyan-300 tracking-widest uppercase">ANA_Speaking</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center relative">
            <video 
              ref={videoPreviewRef} 
              autoPlay 
              muted 
              playsInline
              className={`max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-500 ${isScreenShared ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
            />
            {!isScreenShared && (
              <div className="text-center opacity-30 select-none">
                <div className="w-16 h-16 border border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Video_Input_Awaiting</p>
              </div>
            )}
            {/* Visualizer bars overlapping the preview slightly */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-1 px-4 py-2 bg-black/40 rounded-full backdrop-blur-sm border border-white/5 opacity-80">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1 rounded-full transition-all duration-75 ${isUserSpeaking ? 'bg-blue-500' : isModelSpeaking ? 'bg-cyan-500' : 'bg-slate-800'}`}
                  style={{ height: isActive ? `${4 + Math.random() * (isUserSpeaking || isModelSpeaking ? 16 : 4)}px` : '4px' }}
                />
              ))}
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="w-80 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col min-h-0 shadow-2xl backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800 bg-black/20 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neural_Activity_Log</h3>
            <div className="flex gap-1 items-end">
              {[0.4, 1, 0.7].map((o, i) => (
                <div 
                  key={i} 
                  className={`w-1 rounded-full transition-all ${isActive ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-slate-800'}`}
                  style={{ 
                    height: isActive ? `${8 + (isUserSpeaking || isModelSpeaking ? Math.random() * 12 : 0)}px` : '4px',
                    opacity: o 
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
            {transcriptions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                 <p className="text-[10px] font-black uppercase tracking-tighter">Awaiting_Neural_Handshake</p>
              </div>
            )}
            {transcriptions.map((t, i) => (
              <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end text-right' : 'items-start text-left'}`}>
                <div className="flex items-center gap-2 mb-1 opacity-50">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${t.role === 'user' ? 'text-blue-400' : 'text-cyan-400'}`}>
                    {t.role === 'user' ? 'ACCESS_USER' : 'ANA_ENGINE'}
                  </span>
                </div>
                <div className={`max-w-[95%] text-[11px] leading-relaxed p-2.5 rounded border transition-all ${
                  t.role === 'user' 
                    ? 'bg-slate-800/50 border-slate-700 text-slate-300' 
                    : 'bg-cyan-950/20 border-cyan-800/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
            <div id="scroll-bottom" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;
