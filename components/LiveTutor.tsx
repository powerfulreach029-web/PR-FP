import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getLiveClient } from '../services/geminiService';
import { createPcmBlob, decodeAudioData } from '../services/audioUtils';
import { LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Activity, Info } from 'lucide-react';

const LiveTutor: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  
  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null); // To store the session object (promise or resolved)

  const stopAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
  }, []);

  const startSession = async () => {
    try {
      setStatus('connecting');
      
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Connect to Live API
      const liveClient = getLiveClient();
      
      const sessionPromise = liveClient.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setStatus('connected');
            setIsConnected(true);
            
            // Start processing microphone input
            if (!inputAudioContextRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(base64Audio),
                ctx,
                24000
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
            
            // Handle interruption
             if (message.serverContent?.interrupted) {
                 nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
            console.log('Session closed');
            setIsConnected(false);
            setStatus('idle');
            stopAudio();
          },
          onerror: (err) => {
            console.error('Session error', err);
            setStatus('error');
            stopAudio();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: "Tu es un tuteur pédagogique bienveillant. Tu aides les enseignants à brainstormer des idées de cours. Sois concis et encourageant."
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start session", e);
      setStatus('error');
      stopAudio();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => {
            if (s && typeof s.close === 'function') s.close();
        });
    }
    stopAudio();
    setIsConnected(false);
    setStatus('idle');
  };

  function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-12 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] min-h-[400px] sm:min-h-[500px]">
      <div className="mb-8 text-center max-w-md">
        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Tuteur Vocal Intelligent</h2>
        <p className="text-[var(--text-muted)] text-sm sm:text-base">Discutez en temps réel pour affiner vos idées de cours, brainstormer des activités ou préparer vos séquences.</p>
      </div>

      <div className="relative mb-12">
        <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-[var(--primary-light)] shadow-[var(--primary-light)] shadow-xl' : 'bg-[var(--bg-main)] border border-[var(--border-color)]'}`}>
           {isConnected ? (
             <Activity className="w-16 h-16 sm:w-20 sm:h-20 text-[var(--primary)] animate-pulse" />
           ) : (
             <Volume2 className="w-16 h-16 sm:w-20 sm:h-20 text-[var(--text-muted)]" />
           )}
        </div>
        {isConnected && (
            <>
                <div className="absolute inset-0 rounded-full border-4 border-[var(--primary-light)] animate-ping opacity-30"></div>
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium border border-green-200 whitespace-nowrap">
                    En ligne
                </div>
            </>
        )}
      </div>

      <div className="flex flex-col w-full max-w-xs gap-4">
        {!isConnected ? (
          <button
            onClick={startSession}
            disabled={status === 'connecting'}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary-hover)] transition-all shadow-md hover:shadow-lg disabled:opacity-50 font-semibold text-lg"
          >
            {status === 'connecting' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Mic className="w-6 h-6" />}
            {status === 'connecting' ? 'Connexion...' : 'Démarrer'}
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-200 font-semibold text-lg"
          >
            <MicOff className="w-6 h-6" />
            Terminer
          </button>
        )}
      </div>
      
      {status === 'error' && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 max-w-sm">
             <Info className="w-5 h-5 flex-shrink-0" />
             <p>Une erreur est survenue. Vérifiez votre micro et votre connexion.</p>
          </div>
      )}
      
      <p className="mt-8 text-xs text-[var(--text-muted)] text-center max-w-sm">
        <strong>Note :</strong> Utilise le modèle Gemini 2.5 Flash Native Audio. La conversation est fluide et permet des interruptions naturelles.
      </p>
    </div>
  );
};

export default LiveTutor;