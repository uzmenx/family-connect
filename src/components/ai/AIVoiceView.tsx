import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GEMINI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface VoiceMessage {
  text: string;
  isUser: boolean;
}

const AIVoiceView = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<VoiceMessage[]>([]);
  const [volume, setVolume] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    setVolume(prev => prev * 0.7 + avg * 0.3);
    animFrameRef.current = requestAnimationFrame(updateVolume);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        // Process recorded audio - send as text query since we can't transcribe client-side
        setIsRecording(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setVolume(0);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      updateVolume();
    } catch (err) {
      console.error('Mic error:', err);
      toast.error("Mikrofonga ruxsat berilmadi");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const sendTextQuery = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setHistory(prev => [...prev, { text, isUser: true }]);
    setIsProcessing(true);

    try {
      const messages = history.map(h => ({
        role: h.isUser ? 'user' : 'assistant',
        content: h.text
      }));
      messages.push({ role: 'user', content: text });

      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!resp.ok || !resp.body) throw new Error('Xatolik');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) result += c;
          } catch { break; }
        }
      }

      if (result) {
        setHistory(prev => [...prev, { text: result, isUser: false }]);
        // Try speech synthesis
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(result);
          utterance.lang = 'uz-UZ';
          utterance.rate = 1;
          speechSynthesis.speak(utterance);
        }
      }
    } catch (e) {
      console.error('Voice error:', e);
      toast.error('Javob olishda xatolik');
    } finally {
      setIsProcessing(false);
    }
  };

  const [textInput, setTextInput] = useState('');

  return (
    <div className="h-full flex flex-col items-center justify-between pb-6 px-6">
      {/* Orb Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative gap-5">
        <div onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            'relative w-40 h-40 rounded-full cursor-pointer transition-all duration-500 z-10 flex items-center justify-center',
            isRecording ? 'scale-125' : 'scale-100 hover:scale-105'
          )}>
          {isRecording ? (
            <div className="relative w-full h-full">
              <div className="absolute inset-[-20%] rounded-full opacity-60 blur-3xl transition-transform duration-100"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary)/0.8) 0%, hsl(280 80% 60%/0.8) 50%, transparent 70%)',
                  transform: `scale(${1 + volume * 1.5})`
                }} />
              <div className="absolute inset-0 rounded-full overflow-hidden bg-background shadow-[inset_0_0_20px_hsl(var(--primary)/0.2)]">
                <div className="absolute w-[150%] h-[150%] top-[-25%] left-[-25%] bg-gradient-to-r from-cyan-500 to-blue-600 blur-2xl opacity-80 animate-spin" style={{ animationDuration: '4s', transformOrigin: '40% 40%' }} />
                <div className="absolute w-[150%] h-[150%] top-[-25%] left-[-25%] bg-gradient-to-r from-purple-500 to-pink-600 blur-2xl opacity-80 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse', transformOrigin: '60% 60%' }} />
                <div className="absolute w-full h-full bg-white blur-xl opacity-20 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: Math.max(0.3, 1 - volume * 3) }}>
                <MicOff className="h-8 w-8 text-white drop-shadow-lg" />
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted to-muted/80 rounded-full flex items-center justify-center shadow-lg border border-border/30 group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Mic className={cn("h-10 w-10 text-muted-foreground group-hover:text-foreground transition-colors drop-shadow-md", isProcessing && "animate-pulse")} />
            </div>
          )}
        </div>

        {isRecording && (
          <div className="text-sm font-medium tracking-wider uppercase text-primary/80 animate-pulse">
            Tinglayapman...
          </div>
        )}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Javob tayyorlanmoqda...
          </div>
        )}
      </div>

      {/* Transcript Area */}
      <div className="w-full max-w-md bg-card/50 backdrop-blur-xl border border-border/50 rounded-[28px] p-5 h-[180px] flex flex-col relative overflow-hidden mb-3">
        <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-card/80 to-transparent z-10" />
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {history.length > 0 ? (
            history.slice(-6).map((item, i) => (
              <div key={i} className={cn('text-sm leading-relaxed', item.isUser ? 'text-muted-foreground text-right' : 'text-foreground')}>
                {item.text}
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-4">
              Orb ni bosib suhbat boshlang yoki pastdan yozing
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-card/80 to-transparent z-10" />
      </div>

      {/* Text Input for Voice Tab */}
      <div className="w-full max-w-md bg-card/50 backdrop-blur-2xl border border-border/50 rounded-[28px] flex items-center p-1.5">
        <input value={textInput} onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendTextQuery(textInput); setTextInput(''); } }}
          placeholder="Yozing yoki orb bosing..."
          className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground px-3 h-9 text-sm"
          disabled={isProcessing}
        />
        <button onClick={() => { sendTextQuery(textInput); setTextInput(''); }}
          disabled={!textInput.trim() || isProcessing}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-all',
            textInput.trim() ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'bg-muted text-muted-foreground opacity-50'
          )}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AIVoiceView;
