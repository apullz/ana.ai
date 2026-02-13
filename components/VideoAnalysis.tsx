
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

const VideoAnalysis: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (err) => reject(err);
    });
  };

  const analyzeVideo = async () => {
    if (!videoFile) return;
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const base64Data = await fileToBase64(videoFile);
      // Initialize strictly with process.env.API_KEY as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: videoFile.type,
                },
              },
              {
                text: "Please analyze this video in depth. Provide a summary of events, key objects or people identified, and any significant temporal markers or transitions. Use professional bullet points.",
              },
            ],
          },
        ],
        config: {
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });

      setAnalysis(response.text || 'Analysis failed to return text.');
    } catch (err) {
      console.error('Video Analysis error:', err);
      setAnalysis('An error occurred during video processing.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Deep Video Understanding</h2>
          <p className="text-slate-400">Contextual intelligence for visual narratives powered by Gemini 3 Pro.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row gap-8 shadow-2xl">
          <div className="flex-1 space-y-4">
            <div className="relative group cursor-pointer border-2 border-dashed border-slate-700 rounded-2xl p-8 hover:border-blue-500/50 hover:bg-blue-600/5 transition-all text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h3 className="text-slate-200 font-semibold mb-1">
                {videoFile ? videoFile.name : 'Upload Source Video'}
              </h3>
              <p className="text-slate-500 text-xs">MP4, MOV, or WEBM (Max 50MB recommended)</p>
            </div>

            <button
              onClick={analyzeVideo}
              disabled={!videoFile || isAnalyzing}
              className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing Semantic Data...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  Start Deep Analysis
                </>
              )}
            </button>
          </div>

          <div className="flex-1 min-h-[400px] bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
             {!analysis && !isAnalyzing && (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" /></svg>
                  <p className="text-slate-400">Insight output will appear here</p>
               </div>
             )}
             
             {isAnalyzing && (
               <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                     <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                     </div>
                     <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest">Scanning Frames</p>
                  </div>
               </div>
             )}

             {analysis && (
               <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                 <h4 className="text-white text-lg font-bold mb-4 border-b border-slate-800 pb-2">Analysis Results</h4>
                 <div className="whitespace-pre-wrap leading-relaxed">
                   {analysis}
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysis;
