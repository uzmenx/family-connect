import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Image as ImageIcon, Music2, Play, Pause, RefreshCw, Smile, Type, Volume2, VolumeX, X, Disc } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMOJIS, MEDIA_FILTERS } from './filters';
import FilterStrip from './FilterStrip';
import TextOverlay, { TextItem } from './TextOverlay';

export interface CapturedMedia {
  id: string;
  type: 'photo' | 'video';
  file: File;
  url: string;
  thumbnail?: string;
}

type EditableItem = {
  media: CapturedMedia;
  filter: string;
  texts: TextItem[];
};

interface InstagramMediaCaptureProps {
  onClose: () => void;
  onNext: (items: { file: File; filter: string }[]) => void;
  maxItems?: number;
}

export default function InstagramMediaCapture({ onClose, onNext, maxItems = 5 }: InstagramMediaCaptureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<number>();
  const captureTimerRef = useRef<number>();
  const isTakingPhotoRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [focusedMediaId, setFocusedMediaId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const trayStartYRef = useRef<number | null>(null);

  const [items, setItems] = useState<EditableItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const [showTextInput, setShowTextInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMusicList, setShowMusicList] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [selectedMusic, setSelectedMusic] = useState<{ file: File; name: string; url: string } | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [filterNameVisible, setFilterNameVisible] = useState(false);
  const [filterNameText, setFilterNameText] = useState('');
  const filterTimerRef = useRef<number>();

  const active = items[activeIndex];
  const currentFilter = useMemo(() => {
    const name = active?.filter ?? 'original';
    return MEDIA_FILTERS.find(f => f.name === name) || MEDIA_FILTERS[0];
  }, [active?.filter]);

  const updateActive = useCallback((partial: Partial<EditableItem>) => {
    setItems(prev => prev.map((it, i) => (i === activeIndex ? { ...it, ...partial } : it)));
  }, [activeIndex]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraReady(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    clearInterval(recordTimerRef.current);
    clearTimeout(captureTimerRef.current);
    clearTimeout(filterTimerRef.current);
    return () => {
      clearInterval(recordTimerRef.current);
      clearTimeout(captureTimerRef.current);
      clearTimeout(filterTimerRef.current);
    };
  }, []);

  const addMediaItem = useCallback((media: CapturedMedia) => {
    setItems(prev => {
      const next = [...prev, { media, filter: 'original', texts: [] }];
      // activeIndex should point to the newly added item
      setActiveIndex(next.length - 1);
      return next;
    });
    setFocusedMediaId(media.id);
    setTrayOpen(false);
  }, []);

  const removeMedia = useCallback((id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(x => x.media.id === id);
      const found = prev[idx];
      if (found) URL.revokeObjectURL(found.media.url);
      const next = prev.filter(x => x.media.id !== id);

      // Clamp activeIndex against the new array length.
      setActiveIndex((current) => {
        if (next.length === 0) return 0;
        // If you removed an item before current, shift left.
        const shifted = idx >= 0 && idx < current ? current - 1 : current;
        return Math.max(0, Math.min(shifted, next.length - 1));
      });

      // If nothing left, go back to capture mode.
      if (next.length === 0) setFocusedMediaId(null);
      return next;
    });
  }, []);

  const moveMedia = useCallback((from: number, to: number) => {
    setItems(prev => {
      const arr = [...prev];
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      return arr;
    });
    setActiveIndex((idx) => {
      if (idx === from) return to;
      if (from < idx && idx <= to) return idx - 1;
      if (to <= idx && idx < from) return idx + 1;
      return idx;
    });
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (items.length >= maxItems) return;
    if (isTakingPhotoRef.current) return;
    isTakingPhotoRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (zoom > 1) {
      const sw = video.videoWidth / zoom;
      const sh = video.videoHeight / zoom;
      const sx = (video.videoWidth - sw) / 2;
      const sy = (video.videoHeight - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0);
    }

    canvas.toBlob((blob) => {
      try {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        addMediaItem({ id: crypto.randomUUID(), type: 'photo', file, url });
      } finally {
        isTakingPhotoRef.current = false;
      }
    }, 'image/jpeg', 0.92);
  }, [addMediaItem, items.length, maxItems, zoom]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) return;
    if (items.length >= maxItems) return;

    // Setup audio mixing if music is selected
    let streamToUse = streamRef.current;
    if (selectedMusic) {
      const mixedStream = await setupAudioMixing();
      if (mixedStream) streamToUse = mixedStream;
    }

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(streamToUse, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.currentTime = 0.5;
      tempVideo.onloadeddata = () => {
        const c = document.createElement('canvas');
        c.width = tempVideo.videoWidth;
        c.height = tempVideo.videoHeight;
        c.getContext('2d')?.drawImage(tempVideo, 0, 0);
        const thumb = c.toDataURL('image/jpeg', 0.7);
        addMediaItem({ id: crypto.randomUUID(), type: 'video', file, url, thumbnail: thumb });
      };
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingTime(0);
    recordTimerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    
    // Start playing music if selected
    if (selectedMusic && musicAudioRef.current) {
      musicAudioRef.current.play();
      setIsMusicPlaying(true);
    }
  }, [addMediaItem, items.length, maxItems, selectedMusic]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
      
      // Stop music when recording stops
      if (musicAudioRef.current && isMusicPlaying) {
        musicAudioRef.current.pause();
        setIsMusicPlaying(false);
      }
    }
  }, [isRecording, isMusicPlaying]);

  const handleCaptureStart = useCallback(() => {
    setIsCapturing(true);
    captureTimerRef.current = window.setTimeout(() => startRecording(), 500);
  }, [startRecording]);

  const handleCaptureEnd = useCallback(() => {
    clearTimeout(captureTimerRef.current);
    if (isTakingPhotoRef.current) return;

    if (isRecording) stopRecording();
    else takePhoto();

    setIsCapturing(false);
  }, [isRecording, stopRecording, takePhoto]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRecording) setDragStartY(e.touches[0].clientY);
  }, [isRecording]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRecording && dragStartY !== null) {
      const delta = (dragStartY - e.touches[0].clientY) / 100;
      setZoom(z => Math.max(1, Math.min(5, z + delta)));
      setDragStartY(e.touches[0].clientY);
    }
  }, [isRecording, dragStartY]);

  const handleTouchEnd = useCallback(() => setDragStartY(null), []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = maxItems - items.length;

    Array.from(files).slice(0, remaining).forEach((file, i) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      addMediaItem({
        id: `${Date.now()}-${i}`,
        type: isVideo ? 'video' : 'photo',
        file,
        url,
      });
    });

    e.target.value = '';
  }, [addMediaItem, items.length, maxItems]);

  const addText = useCallback(() => {
    if (!textValue.trim() || !active) return;
    updateActive({
      texts: [
        ...active.texts,
        {
          id: crypto.randomUUID(),
          content: textValue,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
          fontSize: 22,
          isEmoji: false,
        },
      ],
    });
    setTextValue('');
    setShowTextInput(false);
  }, [active, textValue, updateActive]);

  const addEmoji = useCallback((emoji: string) => {
    if (!active) return;
    updateActive({
      texts: [
        ...active.texts,
        {
          id: crypto.randomUUID(),
          content: emoji,
          x: 50,
          y: 35,
          scale: 1,
          rotation: 0,
          fontSize: 40,
          isEmoji: true,
        },
      ],
    });
    setShowEmojiPicker(false);
  }, [active, updateActive]);

  const togglePlay = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [activeIndex]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!active) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;

    // Swipe down on focused media => back to camera
    if (dy > 55 && Math.abs(dy) > Math.abs(dx)) {
      setFocusedMediaId(null);
      setShowEmojiPicker(false);
      setShowTextInput(false);
      return;
    }

    // Horizontal swipe (dominant) => change filter
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      const idx = MEDIA_FILTERS.findIndex(f => f.name === active.filter);
      const next = dx < 0
        ? Math.min(MEDIA_FILTERS.length - 1, idx + 1)
        : Math.max(0, idx - 1);

      if (next !== idx) {
        const f = MEDIA_FILTERS[next];
        updateActive({ filter: f.name });
        setFilterNameText(f.label);
        setFilterNameVisible(true);
        clearTimeout(filterTimerRef.current);
        filterTimerRef.current = window.setTimeout(() => setFilterNameVisible(false), 600);
      }
    }
  }, [active, updateActive]);

  const handleNext = useCallback(() => {
    if (items.length === 0) return;
    onNext(items.map(it => ({ file: it.media.file, filter: it.filter })));
  }, [items, onNext]);

  const handleMusicSelect = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setSelectedMusic({ file, name: file.name, url });
    setIsMusicPlaying(false);
  }, []);

  const toggleMusicPlayback = useCallback(() => {
    if (!musicAudioRef.current || !selectedMusic) return;
    
    if (isMusicPlaying) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      musicAudioRef.current.play();
      setIsMusicPlaying(true);
    }
  }, [isMusicPlaying, selectedMusic]);

  const setupAudioMixing = useCallback(async () => {
    if (!selectedMusic || !streamRef.current) return null;
    
    try {
      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioContext = audioContextRef.current;
      
      // Create music audio element
      const musicAudio = new Audio(selectedMusic.url);
      musicAudio.loop = true;
      musicAudio.volume = 0.3; // 30% volume
      musicAudioRef.current = musicAudio;
      
      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Add camera audio to destination
      if (streamRef.current.getAudioTracks().length > 0) {
        const source = audioContext.createMediaStreamSource(streamRef.current);
        source.connect(destination);
      }
      
      // Add music to destination
      const musicSource = audioContext.createMediaElementSource(musicAudio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.3;
      musicSource.connect(gainNode);
      gainNode.connect(destination);
      
      return destination.stream;
    } catch (error) {
      console.error('Error setting up audio mixing:', error);
      return null;
    }
  }, [selectedMusic]);

  const showTopStrip = items.length > 0;
  const isVideo = active?.media.type === 'video';
  const isFocused = !!focusedMediaId && active?.media.id === focusedMediaId;
  const showCaptureUi = !isFocused && !trayOpen;
  const canAddMore = items.length < maxItems;
  const lastThree = useMemo(() => items.slice(-3), [items]);
  const trayPeekHeight = '5.25rem';

  const handleSelectFromStrip = useCallback((idx: number) => {
    const it = items[idx];
    if (!it) return;
    setActiveIndex(idx);
    setTrayOpen(false);

    setFocusedMediaId((cur) => {
      if (cur === it.media.id) return null;
      return it.media.id;
    });
  }, [items]);

  const handleTrayTouchStart = useCallback((e: React.TouchEvent) => {
    trayStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTrayTouchEnd = useCallback((e: React.TouchEvent) => {
    if (trayStartYRef.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const diff = endY - trayStartYRef.current;
    trayStartYRef.current = null;
    if (Math.abs(diff) < 35) return;
    // swipe up => open, swipe down => close
    if (diff < 0) {
      setTrayOpen(true);
    } else {
      setTrayOpen(false);
      // requirement: tray swipe down also returns to camera
      setFocusedMediaId(null);
      setShowEmojiPicker(false);
      setShowTextInput(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {items.length > 0 && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform"
          >
            Keyingi
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stage: Capture - camera always as base */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn('absolute inset-0 w-full h-full object-cover')}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Flip camera */}
        {showCaptureUi && (
          <>
            {/* Zoom pills (center, above shutter) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1"
              style={{ bottom: `calc(${trayPeekHeight} + max(2.25rem, env(safe-area-inset-bottom)) + 4.5rem)` }}
            >
              <div className="flex gap-0.5 p-0.5 rounded-full bg-white/10 backdrop-blur-sm">
                {[1, 2, 5].map((zl) => (
                  <button
                    key={zl}
                    onClick={() => setZoom(zl)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-bold transition-all',
                      Math.abs(zoom - zl) < 0.5 ? 'bg-white/25 text-white' : 'text-white/40'
                    )}
                  >
                    {zl}x
                  </button>
                ))}
              </div>
              <span className="text-white/50 text-[10px] font-medium">{items.length}/{maxItems}</span>
            </div>

            {/* Music button */}
            <button
              type="button"
              onClick={() => setShowMusicList(true)}
              className="absolute left-8 z-20 w-12 h-12 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform group"
              aria-label="Music"
              style={{ bottom: `calc(${trayPeekHeight} + max(0.75rem, env(safe-area-inset-bottom)))` }}
            >
              <Music2 className="w-6 h-6 text-white animate-pulse-slow group-hover:animate-bounce-slow transition-all duration-500" />
            </button>

            {/* Flip camera (bottom-right) */}
            <button
              onClick={() => setFacingMode(f => (f === 'environment' ? 'user' : 'environment'))}
              className="absolute right-8 z-20 w-12 h-12 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform group"
              aria-label="Switch camera"
              style={{ bottom: `calc(${trayPeekHeight} + max(0.75rem, env(safe-area-inset-bottom)))` }}
            >
              <RefreshCw className="w-6 h-6 text-white animate-spin-very-slow group-hover:animate-spin transition-all duration-500" />
            </button>
          </>
        )}

        {/* Capture button */}
        {showCaptureUi && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center justify-center"
            style={{ bottom: `calc(${trayPeekHeight} + max(0.75rem, env(safe-area-inset-bottom)))` }}
          >
            <button
              onMouseDown={handleCaptureStart}
              onMouseUp={handleCaptureEnd}
              onMouseLeave={() => { if (isCapturing) handleCaptureEnd(); }}
              onTouchStart={(e) => { handleCaptureStart(); handleTouchStart(e); }}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => { handleCaptureEnd(); handleTouchEnd(); }}
              disabled={!cameraReady || !canAddMore}
              className={cn(
                'relative w-[78px] h-[78px] rounded-full flex items-center justify-center disabled:opacity-30',
                isCapturing ? 'scale-[0.98]' : 'scale-100'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-full p-[3px] shutter-neon-rotate',
                  "bg-[conic-gradient(from_180deg_at_50%_50%,#00F5FF_0deg,#7C3AED_90deg,#FF2BD6_180deg,#00F5FF_360deg)]",
                  'shadow-[0_0_14px_rgba(0,245,255,0.22),0_0_16px_rgba(255,43,214,0.12)]'
                )}
              >
                <div className="relative w-full h-full rounded-full bg-black/30 backdrop-blur-sm border border-white/20 overflow-hidden">
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full opacity-55 mix-blend-screen',
                      "bg-[repeating-conic-gradient(from_200deg,rgba(255,255,255,0.0)_0deg,rgba(255,255,255,0.0)_10deg,rgba(255,255,255,0.35)_14deg,rgba(255,255,255,0.0)_18deg)]"
                    )}
                    style={{
                      WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 0 52%, #000 56% 100%)',
                      maskImage: 'radial-gradient(circle at 50% 50%, transparent 0 52%, #000 56% 100%)',
                    }}
                  />

                  <span className="shutter-spark" style={{ top: '10%', left: '72%', animationDelay: '0ms' }} />
                  <span className="shutter-spark" style={{ top: '72%', left: '16%', animationDelay: '650ms' }} />
                  <span className="shutter-spark" style={{ top: '38%', left: '8%', animationDelay: '1100ms' }} />
                </div>
              </div>

              <div className="absolute inset-[9px] rounded-full bg-black/25 border border-white/10" />

              <div
                className={cn(
                  'relative transition-all duration-200',
                  isCapturing ? 'scale-[0.84]' : 'scale-100',
                  isRecording ? 'w-8 h-8 rounded-lg bg-red-500' : 'w-[58px] h-[58px] rounded-full bg-white'
                )}
              >
                {isRecording && <div className="absolute inset-0 rounded-lg animate-pulse bg-red-400" />}
              </div>
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-[3px] border-red-400/80 shadow-[0_0_18px_rgba(239,68,68,0.35)] animate-ping" />
              )}
            </button>
          </div>
        )}

        {/* Recording badge with music info */}
        {showCaptureUi && isRecording && (
          <>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-[11px] font-medium">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
            </div>
            
            {/* Music info overlay */}
            {selectedMusic && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/20">
                <Disc className="w-4 h-4 text-primary" />
                <span className="text-white text-xs font-medium truncate max-w-[120px]">{selectedMusic.name}</span>
                <button
                  onClick={toggleMusicPlayback}
                  className="w-6 h-6 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
                >
                  {isMusicPlaying ? (
                    <Pause className="w-3 h-3 text-white" />
                  ) : (
                    <Play className="w-3 h-3 text-white" />
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Selected strip (top) */}
        {showTopStrip && (
          <div className="absolute left-2 right-2 z-20" style={{ top: 'max(3.75rem, calc(env(safe-area-inset-top) + 2.75rem))' }}>
            <div className="flex gap-1.5 p-1.5 rounded-2xl bg-black/50 backdrop-blur-xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {items.map((it, idx) => (
                <div
                  key={it.media.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('idx', idx.toString())}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveMedia(parseInt(e.dataTransfer.getData('idx')), idx); }}
                  className={cn('relative flex-shrink-0', idx === activeIndex ? 'opacity-100' : 'opacity-70')}
                  onClick={() => handleSelectFromStrip(idx)}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/15">
                    {it.media.type === 'photo' ? (
                      <img src={it.media.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full">
                        <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMedia(it.media.id); }}
                    className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-destructive flex items-center justify-center shadow"
                  >
                    <X className="w-2.5 h-2.5 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Focused preview layer (edit mode) */}
        {isFocused && active && (
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900/70 via-purple-900/55 to-slate-900/70 flex flex-col">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center px-1 pt-14">
              <div
                ref={containerRef}
                className="relative w-full max-w-md aspect-[9/16] max-h-[calc(100vh-260px)] rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleSwipeEnd}
              >
                {isVideo ? (
                  <video
                    ref={previewVideoRef}
                    src={active.media.url}
                    className="w-full h-full object-cover"
                    style={{ filter: currentFilter.css }}
                    playsInline
                    loop
                    muted={isMuted}
                    onClick={togglePlay}
                  />
                ) : (
                  <img
                    src={active.media.url}
                    alt="Edit"
                    className="w-full h-full object-cover"
                    style={{ filter: currentFilter.css }}
                  />
                )}

                {active.texts.map(t => (
                  <TextOverlay
                    key={t.id}
                    item={t}
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onUpdate={(updated) => updateActive({ texts: active.texts.map(x => (x.id === updated.id ? updated : x)) })}
                    onDelete={(id) => updateActive({ texts: active.texts.filter(x => x.id !== id) })}
                  />
                ))}

                {filterNameVisible && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <div className="px-5 py-2.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/20">
                      <span className="text-white font-bold text-xl">{filterNameText}</span>
                    </div>
                  </div>
                )}

                {isVideo && (
                  <button onClick={togglePlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-xl border border-white/25 flex items-center justify-center">
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </button>
                )}
              </div>

              {/* Edit tools */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowTextInput(false);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                    <Smile className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Stiker</span>
                </button>

                <button
                  onClick={() => {
                    setShowTextInput(true);
                    setShowEmojiPicker(false);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] text-white/70 font-medium">Matn</span>
                </button>

                {isVideo && (
                  <button
                    onClick={() => {
                      const nextMuted = !isMuted;
                      setIsMuted(nextMuted);
                      if (previewVideoRef.current) previewVideoRef.current.muted = nextMuted;
                    }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </div>
                    <span className="text-[9px] text-white/70 font-medium">Ovoz</span>
                  </button>
                )}
              </div>

              {showEmojiPicker && (
                <div className="absolute bottom-24 right-2 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 grid grid-cols-6 gap-2 max-w-[260px] z-50">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => addEmoji(emoji)} className="text-2xl p-1 rounded-lg hover:bg-white/10 transition-colors">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 pb-4">
              <FilterStrip selectedFilter={active.filter} onSelectFilter={(f) => updateActive({ filter: f })} />
            </div>

            {showTextInput && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl p-5 w-full max-w-sm space-y-4">
                  <h3 className="font-semibold text-lg text-white">Matn qo'shish</h3>
                  <textarea
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="Matn, @mention, #hashtag..."
                    className="w-full h-24 p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowTextInput(false);
                        setTextValue('');
                      }}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white font-medium"
                    >
                      Bekor
                    </button>
                    <button
                      onClick={addText}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Qo'shish
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Music List Modal */}
        {showMusicList && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end">
            <div className="w-full bg-black/90 backdrop-blur-2xl border-t border-white/20 rounded-t-3xl max-h-[70vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Disc className="w-6 h-6 text-primary" />
                  <h2 className="text-white font-semibold text-lg">Musiqa</h2>
                </div>
                <button
                  onClick={() => setShowMusicList(false)}
                  className="w-10 h-10 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Music List */}
              <div className="overflow-y-auto max-h-[50vh]">
                {/* File Upload Section */}
                <div className="p-4 border-b border-white/10">
                  <label className="block">
                    <div className="w-full p-3 border-2 border-dashed border-white/30 rounded-xl text-center cursor-pointer hover:border-white/50 transition-colors">
                      <Disc className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-white text-sm font-medium">Musiqa yuklash</p>
                      <p className="text-white/50 text-xs mt-1">MP3, WAV, M4A</p>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMusicSelect(file);
                        }}
                        className="hidden"
                      />
                    </div>
                  </label>
                </div>

                {/* Selected Music Display */}
                {selectedMusic && (
                  <div className="p-4 border-b border-white/10 bg-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Disc className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-sm">{selectedMusic.name}</h4>
                          <p className="text-white/60 text-xs">Tanlangan musiqa</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleMusicPlayback}
                        className="w-10 h-10 rounded-full glass-button flex items-center justify-center active:scale-90 transition-transform"
                      >
                        {isMusicPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Demo Tracks */}
                <div className="p-4">
                  <h3 className="text-white/70 text-xs font-semibold mb-3">Tavsiya etilgan</h3>
                  {[
                    { id: 1, title: 'Summer Vibes', artist: 'DJ Sunset', duration: '3:24', cover: '🌅' },
                    { id: 2, title: 'Night Drive', artist: 'Luna Wave', duration: '4:15', cover: '🌙' },
                    { id: 3, title: 'Ocean Breeze', artist: 'Coastal Beats', duration: '2:58', cover: '🌊' },
                    { id: 4, title: 'City Lights', artist: 'Urban Flow', duration: '3:42', cover: '🌃' },
                    { id: 5, title: 'Mountain High', artist: 'Alpine Sound', duration: '4:03', cover: '🏔️' },
                    { id: 6, title: 'Desert Wind', artist: 'Sahara Vibes', duration: '3:36', cover: '🏜️' },
                  ].map((track) => (
                    <button
                      key={track.id}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5"
                    >
                      {/* Cover */}
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-2xl">
                        {track.cover}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 text-left">
                        <h3 className="text-white font-medium text-sm">{track.title}</h3>
                        <p className="text-white/60 text-xs">{track.artist}</p>
                      </div>
                      
                      {/* Duration & Play */}
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 text-xs">{track.duration}</span>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Play className="w-4 h-4 text-primary" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom tray */}
        <div
          className={cn(
            'absolute left-0 right-0 z-40 transition-transform duration-250',
            trayOpen ? 'translate-y-0' : 'translate-y-[calc(100%_-_5.25rem)]'
          )}
          style={{ bottom: 0 }}
          onTouchStart={handleTrayTouchStart}
          onTouchEnd={handleTrayTouchEnd}
        >
          <div className="bg-black/70 backdrop-blur-xl border-t border-white/10 rounded-t-3xl overflow-hidden">
            <div className="flex items-center justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            {/* Collapsed row: last 3 previews + gallery */}
            {!trayOpen && (
              <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-4 gap-2 items-center">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const it = lastThree[i];
                    if (!it) return <div key={`empty-${i}`} className="w-12 h-12" />;
                    const idx = items.length - lastThree.length + i;
                    return (
                      <button
                        key={it.media.id}
                        onClick={() => handleSelectFromStrip(idx)}
                        className={cn(
                          'w-12 h-12 rounded-xl overflow-hidden border-2',
                          idx === activeIndex ? 'border-primary' : 'border-white/15'
                        )}
                      >
                        <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canAddMore}
                    className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
                  >
                    <ImageIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Expanded: grid of selected items */}
            {trayOpen && (
              <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/70 text-xs font-semibold">Tanlanganlar</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canAddMore}
                    className="text-white/80 text-xs font-semibold px-3 py-2 rounded-full bg-white/10 border border-white/15 disabled:opacity-30"
                  >
                    Galereya
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-[52vh] overflow-y-auto">
                  {items.map((it, idx) => (
                    <button
                      key={it.media.id}
                      onClick={() => {
                        setTrayOpen(false);
                        setActiveIndex(idx);
                        setFocusedMediaId(it.media.id);
                      }}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2',
                        idx === activeIndex ? 'border-primary' : 'border-white/15'
                      )}
                    >
                      <img src={it.media.thumbnail || it.media.url} alt="" className="w-full h-full object-cover" />
                      {it.media.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
