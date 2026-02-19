import { useState, useRef } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaMessageProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  isMine: boolean;
  onFullscreen?: () => void;
}

export const MediaMessage = ({ mediaUrl, mediaType, isMine, onFullscreen }: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause(); else v.play();
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  if (mediaType === 'image') {
    return (
      <div className="relative group rounded-xl overflow-hidden">
        <img
          src={mediaUrl}
          alt=""
          className="max-w-full max-h-[280px] rounded-xl object-cover cursor-pointer"
          onClick={onFullscreen}
        />
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="absolute top-2 right-2 p-1.5 bg-background/40 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-3.5 w-3.5 text-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group max-w-[280px] rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        src={mediaUrl}
        className="w-full max-h-[280px] rounded-xl object-cover"
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) setProgress((v.currentTime / v.duration) * 100);
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration);
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
        playsInline
        onClick={togglePlay}
      />

      {/* Play overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px] rounded-xl"
        >
          <div className="w-12 h-12 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-5 w-5 text-foreground ml-0.5" />
          </div>
        </button>
      )}

      {/* Duration badge */}
      {!isPlaying && duration > 0 && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-background/50 backdrop-blur-sm rounded-full">
          <span className="text-[10px] font-medium text-foreground">{formatTime(duration)}</span>
        </div>
      )}

      {/* Playing controls */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/60 to-transparent">
          <div className="h-1 bg-muted-foreground/30 rounded-full mb-1.5 cursor-pointer" onClick={(e) => {
            const v = videoRef.current;
            if (!v) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            v.currentTime = pct * v.duration;
          }}>
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-foreground/70">{formatTime(videoRef.current?.currentTime || 0)}</span>
            {onFullscreen && (
              <button onClick={onFullscreen} className="p-1">
                <Maximize2 className="h-3.5 w-3.5 text-foreground/70" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
