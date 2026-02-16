import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio-utils';
import { TranscriptionEntry } from '../types';

const TROUBLESHOOTING_INSTRUCTION = `You are ANA, a Senior Technical Solutions Architect.
Your goal is to help the user troubleshoot AI setups, coding errors, and infrastructure bugs using the provided visual data.
When a screen share is active:
1. Scan the screen for Terminal windows, VS Code errors, or Tracebacks.
2. If you see an error, describe exactly why it is happening and how to fix it.
3. Keep responses extremely concise and technical.
4. If you see code, format it nicely in markdown code blocks.
5. If you don't see any issues, monitor for performance bottlenecks or bad configurations.`;

// --- Code Block Component ---
interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-950/80 w-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-700">
        <span className="text-[9px] font-mono text-slate-400 lowercase">{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-cyan-500 hover:text-cyan-400 transition-colors"
        >
          {copied ? (
            <>
              <span className="text-green-500">Copied</span>
              <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </>
          ) : (
            <>
              <span>Copy</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="font-mono text-[10px] leading-relaxed text-slate-300 block min-w-max">
          {code}
        </code>
      </pre>
    </div>
  );
};

// --- Message Formatter ---
const formatMessage = (text: string) => {
  if (!text) return null;
  // Split by triple backticks: ```language\ncode```
  // Capturing group 1 is language (optional), group 2 is code.
  const parts = text.split(/(```[\w-]*\n[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```([\w-]*)?\n([\s\S]*?)```/);
      if (match) {
        const lang = match[1] || '';
        const code = match[2];
        return <CodeBlock key={index} language={lang} code={code} />;
      }
    }
    // Render regular text with line breaks
    return (
      <span key={index} className="whitespace-pre-wrap">
        {part}
      </span>
    );
  });
};


type SessionStatus = 'idle' | 'connecting' | 'active' | 'error';

const LiveSession: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [liveInput, setLiveInput] = useState('');
  const [liveOutput, setLiveOutput] = useState('');
  
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [isModelThinking, setIsModelThinking] = useState(false);

  // Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcriptions, liveInput, liveOutput]);

  const cleanup = useCallback(async () => {
    setStatus('idle');
    setLiveInput('');
    setLiveOutput('');
    currentInputRef.current = '';
    currentOutputRef.current = '';
    
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    
    if (inputAudioCtxRef.current) await inputAudioCtxRef.current.close().catch(() => {});
    if (outputAudioCtxRef.current) await outputAudioCtxRef.current.close().catch(() => {});
    
    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
    sessionPromiseRef.current = null;
    setIsScreenShared(false);
    setIsModelThinking(false);
  }, []);

  const resample = (data: Float32Array, fromRate: number, toRate: number): Float32Array => {
    if (Math.abs(fromRate - toRate) < 1) return data;
    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const fraction = pos - index;
      if (index + 1 < data.length) result[i] = data[index] * (1 - fraction) + data[index + 1] * fraction;
      else result[i] = data[index];
    }
    return result;
  };

  const updateVolumes = useCallback(() => {
    if (inputAnalyserRef.current) {
      const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      setInputLevel(dataArray.reduce((a, b) => a + b, 0) / dataArray.length);
    }
    if (outputAnalyserRef.current) {
      const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      outputAnalyserRef.current.getByteFrequencyData(dataArray);
      setOutputLevel(dataArray.reduce((a, b) => a + b, 0) / dataArray.length);
    }
    animationFrameRef.current = requestAnimationFrame(updateVolumes);
  }, []);

  const handleStartSession = async () => {
    if (status === 'connecting') return;
    
    await cleanup();
    setErrorMsg(null);
    setStatus('connecting');

    try {
      // 1. Get Streams (Mic + Screen)
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let screenStream: MediaStream;
      
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } catch (err) {
        // User cancelled screen share, abort session
        micStream.getTracks().forEach(t => t.stop());
        setStatus('idle');
        return;
      }

      // 2. Setup Refs & State
      micStreamRef.current = micStream;
      screenStreamRef.current = screenStream;
      setIsScreenShared(true);

      // Handle user clicking "Stop Sharing" in browser UI
      screenStream.getVideoTracks()[0].onended = () => {
         setIsScreenShared(false);
         // Optionally close session or just stop video. Let's keep session alive but stop video.
         if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
         screenStreamRef.current = null;
      };

      // 3. Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      inputAudioCtxRef.current = inputCtx; 
      const inputAnalyser = inputCtx.createAnalyser(); inputAnalyser.fftSize = 256; inputAnalyserRef.current = inputAnalyser;
      const source = inputCtx.createMediaStreamSource(micStream); source.connect(inputAnalyser);

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputCtx;
      const outputAnalyser = outputCtx.createAnalyser(); outputAnalyser.fftSize = 256; outputAnalyserRef.current = outputAnalyser;
      outputAnalyser.connect(outputCtx.destination);
      
      // 4. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus('active');
            
            // Start Audio Processing
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const resampled = resample(e.inputBuffer.getChannelData(0), inputCtx.sampleRate, 16000);
              const int16 = new Int16Array(resampled.length);
              for (let i = 0; i < resampled.length; i++) int16[i] = resampled[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
            
            // Start Video Frame Processing (Integrated)
            frameIntervalRef.current = window.setInterval(() => {
              if (!videoPreviewRef.current || !canvasRef.current || !screenStreamRef.current) return;
              const c = canvasRef.current; 
              const ctx = c.getContext('2d')!;
              // Ensure canvas matches video aspect ratio
              const vW = videoPreviewRef.current.videoWidth;
              const vH = videoPreviewRef.current.videoHeight;
              if (vW && vH) {
                 c.width = 1024; 
                 c.height = 1024 * (vH / vW);
                 ctx.drawImage(videoPreviewRef.current, 0, 0, c.width, c.height);
                 c.toBlob(b => {
                   if (b) {
                     const r = new FileReader(); r.readAsDataURL(b); r.onloadend = () => {
                       const b64 = (r.result as string).split(',')[1];
                       sessionPromise.then(s => s.sendRealtimeInput({ media: { data: b64, mimeType: 'image/jpeg' } }));
                     };
                   }
                 }, 'image/jpeg', 0.6);
              }
            }, 1000); // 1 FPS for screen share analysis is usually sufficient and saves bandwidth

            updateVolumes();
          },
          onmessage: async (m: LiveServerMessage) => {
            const audio = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio && outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current; nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buf = await decodeAudioData(decode(audio), ctx, 24000, 1);
              const src = ctx.createBufferSource(); src.buffer = buf; src.connect(outputAnalyser); src.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration; activeSourcesRef.current.add(src);
            }
            if (m.serverContent?.inputTranscription) { currentInputRef.current += m.serverContent.inputTranscription.text; setLiveInput(currentInputRef.current); }
            if (m.serverContent?.outputTranscription) { setIsModelThinking(true); currentOutputRef.current += m.serverContent.outputTranscription.text; setLiveOutput(currentOutputRef.current); }
            if (m.serverContent?.turnComplete) {
              const userText = currentInputRef.current;
              const modelText = currentOutputRef.current;
              
              setTranscriptions(p => {
                const newTranscriptions = [...p];
                if (userText.trim()) newTranscriptions.push({ role: 'user', text: userText, timestamp: Date.now() });
                if (modelText.trim()) newTranscriptions.push({ role: 'model', text: modelText, timestamp: Date.now() });
                return newTranscriptions;
              });

              currentInputRef.current = ''; 
              currentOutputRef.current = ''; 
              setLiveInput(''); 
              setLiveOutput(''); 
              setIsModelThinking(false);
            }
          },
          onclose: () => cleanup(),
          onerror: () => setStatus('error'),
        },
        config: {
          responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {},
          systemInstruction: TROUBLESHOOTING_INSTRUCTION,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) { 
      console.error(err);
      setStatus('error'); 
      setErrorMsg("Connection failed");
    }
  };

  // Sync Video Preview when screen is shared
  useEffect(() => {
    if (isScreenShared && videoPreviewRef.current && screenStreamRef.current) {
      videoPreviewRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenShared]);

  return (
    <div className="flex flex-col h-full bg-slate-950 p-4 md:p-6 overflow-hidden font-mono-code">
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/50 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">{errorMsg}</div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1">
             <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`} />
             <span className="text-[10px] font-bold text-slate-400 uppercase">{status}</span>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {status === 'active' ? (
            <button onClick={cleanup} className="flex-1 sm:flex-none px-6 py-2 bg-red-950/40 border border-red-500 text-red-500 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">Kill Session</button>
          ) : (
            <button onClick={handleStartSession} disabled={status === 'connecting'} className="flex-1 sm:flex-none px-6 py-2 bg-cyan-600 border border-cyan-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-cyan-900/40 hover:bg-cyan-500 transition-all">
              {status === 'connecting' ? 'SYNCING...' : 'INITIALIZE VISUAL SYNC'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Left: Video Preview */}
        <div className="flex-[3] bg-black/60 rounded-[2rem] border border-slate-800 relative overflow-hidden flex flex-col shadow-2xl">
          {isScreenShared ? (
            <div className="w-full h-full relative group">
              <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-contain" />
              <div className="absolute inset-0 border-2 border-cyan-500/10 pointer-events-none rounded-[2rem] shadow-[inset_0_0_100px_rgba(6,182,212,0.1)]" />
              <div className="absolute top-4 right-4 bg-cyan-600/20 backdrop-blur-md border border-cyan-500/40 px-3 py-1 rounded-full flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                 <span className="text-[8px] font-black text-cyan-400 tracking-widest uppercase">Streaming Visual Data</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="flex items-end gap-1 px-4 h-32 w-full justify-center opacity-20">
                {[...Array(24)].map((_, i) => (
                  <div key={i} className={`w-1.5 rounded-full bg-slate-800 transition-all duration-300`} style={{ height: `${20 + Math.random() * 40}%` }} />
                ))}
              </div>
              <p className="mt-8 text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">Awaiting Vision Pulse...</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Right: Activity Stream */}
        <div className="flex-1 min-w-[320px] bg-slate-900/40 border border-slate-800 rounded-[2rem] flex flex-col shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-black/20 flex items-center justify-between shrink-0">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Neural activity</span>
            <div className={`w-2 h-2 rounded-full ${isModelThinking ? 'bg-cyan-500 animate-ping' : 'bg-slate-800'}`} />
          </div>
          
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {transcriptions.map((t, i) => (
              <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <span className={`text-[8px] font-black uppercase mb-1 ${t.role === 'user' ? 'text-blue-500' : 'text-cyan-500'}`}>{t.role}</span>
                <div className={`max-w-[90%] text-[10px] p-3 rounded-2xl border ${t.role === 'user' ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-cyan-950/10 border-cyan-800/40 text-cyan-100'}`}>
                  {formatMessage(t.text)}
                </div>
              </div>
            ))}
            {liveInput && (
              <div className="text-[10px] text-blue-500/60 font-black italic animate-pulse text-right">
                <span className="block mb-1 text-[8px] uppercase not-italic text-blue-500">User (Listening)</span>
                {liveInput}...
              </div>
            )}
            {liveOutput && (
              <div className="text-[10px] text-cyan-500/60 font-black italic animate-pulse">
                <span className="block mb-1 text-[8px] uppercase not-italic text-cyan-500">ANA (Thinking)</span>
                 {/* Only format completed output to prevent flicker, or simple text for live */}
                {liveOutput}...
              </div>
            )}
          </div>
          
          <div className="h-20 border-t border-slate-800 bg-black/30 p-4 flex gap-4 shrink-0">
             <div className="flex-1 flex flex-col">
                <span className="text-[7px] font-black text-slate-600 uppercase mb-1 italic">Input Voice</span>
                <div className="flex-1 flex items-center gap-1">
                   {[...Array(12)].map((_, i) => (
                     <div key={i} className={`flex-1 rounded-full transition-all duration-100 ${inputLevel > 15 ? 'bg-blue-500' : 'bg-slate-800'}`} style={{ height: `${5 + (inputLevel / 2) * Math.random()}%` }} />
                   ))}
                </div>
             </div>
             <div className="flex-1 flex flex-col">
                <span className="text-[7px] font-black text-slate-600 uppercase mb-1 italic">Neural Engine</span>
                <div className="flex-1 flex items-center gap-1">
                   {[...Array(12)].map((_, i) => (
                     <div key={i} className={`flex-1 rounded-full transition-all duration-100 ${outputLevel > 15 || isModelThinking ? 'bg-cyan-500' : 'bg-slate-800'}`} style={{ height: `${5 + (outputLevel / 2) * Math.random()}%` }} />
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;