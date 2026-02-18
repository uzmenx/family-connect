import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { cn } from '@/lib/utils';

type LayoutMode = 'pip' | 'split';

interface VideoCallUIProps {
  callObject: DailyCall;
  remoteParticipant: DailyParticipant | null;
  cameraOn: boolean;
  micOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
}

export const VideoCallUI = ({
  callObject,
  remoteParticipant,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  onEndCall,
}: VideoCallUIProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Layout
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pip');
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // PiP drag
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const [pipSize, setPipSize] = useState({ w: 120, h: 170 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  
  // Swapped: which video is in PiP
  const [localInPip, setLocalInPip] = useState(true);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const handleScreenTap = () => {
    resetHideTimer();
  };

  // Video tracks
  useEffect(() => {
    if (!callObject) return;

    const updateLocal = () => {
      const lp = callObject.participants()?.local;
      if (lp?.videoTrack && localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([lp.videoTrack]);
      }
    };

    const updateRemote = () => {
      if (remoteParticipant?.videoTrack && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = new MediaStream([remoteParticipant.videoTrack]);
      }
      if (remoteParticipant?.audioTrack) {
        const audioEl = document.getElementById('remote-audio') as HTMLAudioElement;
        if (audioEl) {
          audioEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
        } else {
          const newEl = document.createElement('audio');
          newEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
          newEl.autoplay = true;
          newEl.id = 'remote-audio';
          document.body.appendChild(newEl);
        }
      }
    };

    updateLocal();
    updateRemote();
    callObject.on('participant-updated', () => { updateLocal(); updateRemote(); });

    return () => { 
      const el = document.getElementById('remote-audio');
      if (el) el.remove();
    };
  }, [callObject, remoteParticipant]);

  // PiP Drag handlers
  const handlePipPointerDown = (e: React.PointerEvent) => {
    if (layoutMode !== 'pip') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: pipPosition.x, py: pipPosition.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePipPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxX = window.innerWidth - pipSize.w - 8;
    const maxY = window.innerHeight - pipSize.h - 8;
    setPipPosition({
      x: Math.max(8, Math.min(maxX, dragStartRef.current.px + dx)),
      y: Math.max(8, Math.min(maxY, dragStartRef.current.py + dy)),
    });
  };

  const handlePipPointerUp = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: pipSize.w, h: pipSize.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;
    const newW = Math.max(80, Math.min(250, resizeStartRef.current.w + dx));
    const newH = Math.max(110, Math.min(350, resizeStartRef.current.h + dy));
    setPipSize({ w: newW, h: newH });
  };

  const handleResizePointerUp = () => {
    setIsResizing(false);
  };

  const renderVideo = (
    ref: React.RefObject<HTMLVideoElement>,
    hasVideo: boolean,
    isMirror: boolean,
    className: string,
    label?: string
  ) => (
    <div className={cn("bg-muted flex items-center justify-center overflow-hidden", className)}>
      {hasVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={isMirror}
          className={cn("w-full h-full object-cover", isMirror && "scale-x-[-1]")}
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <VideoOff className="h-8 w-8" />
          </div>
          {label && <p className="text-xs">{label}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 bg-background" 
      onClick={handleScreenTap}
      onTouchStart={handleScreenTap}
    >
      {layoutMode === 'split' ? (
        /* 50/50 Split Mode */
        <div className="flex flex-col h-full">
          {renderVideo(
            localInPip ? remoteVideoRef : localVideoRef,
            localInPip ? !!remoteParticipant?.video : cameraOn,
            !localInPip,
            "flex-1",
            localInPip ? "Kutilmoqda..." : undefined
          )}
          <div className="h-px bg-border" />
          {renderVideo(
            localInPip ? localVideoRef : remoteVideoRef,
            localInPip ? cameraOn : !!remoteParticipant?.video,
            localInPip,
            "flex-1",
            !localInPip ? "Kutilmoqda..." : undefined
          )}
        </div>
      ) : (
        /* PiP Mode */
        <>
          {/* Main (full screen) */}
          {renderVideo(
            localInPip ? remoteVideoRef : localVideoRef,
            localInPip ? !!remoteParticipant?.video : cameraOn,
            !localInPip,
            "absolute inset-0",
            localInPip ? "Kutilmoqda..." : undefined
          )}

          {/* PiP Window (draggable + resizable) */}
          <div
            className="absolute rounded-2xl overflow-hidden shadow-2xl border-2 border-background/50 cursor-grab active:cursor-grabbing touch-none"
            style={{
              left: pipPosition.x,
              top: pipPosition.y,
              width: pipSize.w,
              height: pipSize.h,
              zIndex: 10,
            }}
            onPointerDown={handlePipPointerDown}
            onPointerMove={handlePipPointerMove}
            onPointerUp={handlePipPointerUp}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setLocalInPip(!localInPip);
            }}
          >
            {renderVideo(
              localInPip ? localVideoRef : remoteVideoRef,
              localInPip ? cameraOn : !!remoteParticipant?.video,
              localInPip,
              "w-full h-full"
            )}
            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize touch-none"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
            >
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-white/60 rounded-br-sm" />
            </div>
          </div>
        </>
      )}

      {/* Controls — auto-hide */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="bg-gradient-to-t from-black/60 to-transparent pt-16 pb-8 px-4">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full backdrop-blur-md",
                cameraOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleCamera(); }}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full backdrop-blur-md",
                micOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleMic(); }}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-destructive text-destructive-foreground"
              onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/20 text-white backdrop-blur-md"
              onClick={(e) => {
                e.stopPropagation();
                setLayoutMode(layoutMode === 'pip' ? 'split' : 'pip');
              }}
            >
              {layoutMode === 'pip' ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/20 text-white backdrop-blur-md"
              onClick={(e) => {
                e.stopPropagation();
                setLocalInPip(!localInPip);
              }}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
