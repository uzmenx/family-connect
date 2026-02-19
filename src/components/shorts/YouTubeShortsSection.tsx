import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

export interface Short {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface YouTubeShortsProps {
  onShortClick?: (shorts: Short[], index: number) => void;
}

export function YouTubeShortsSection({ onShortClick }: YouTubeShortsProps) {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShorts();
  }, []);

  const fetchShorts = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/youtube-shorts?q=shorts`,
        { headers: { apikey: anonKey } }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setShorts(data?.shorts || []);
    } catch (err) {
      console.error('Failed to fetch shorts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -160 : 160,
      behavior: 'smooth',
    });
  }, []);

  if (isLoading) {
    return (
      <div className="px-3 pt-1 pb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded bg-muted/50 animate-pulse" />
          <div className="w-16 h-3 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[110px] h-[196px] rounded-2xl bg-muted/30 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (shorts.length === 0) return null;

  return (
    <div className="pt-1 pb-2">
      {/* Header - compact */}
      <div className="flex items-center justify-between px-3 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-destructive" />
          <span className="font-semibold text-xs text-foreground">Shorts</span>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => scroll('left')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20"
          >
            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20"
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Carousel - compact cards */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-3 snap-x snap-mandatory"
      >
        {shorts.map((short, index) => (
          <div
            key={short.id}
            className="relative w-[110px] h-[196px] rounded-2xl overflow-hidden shrink-0 snap-start cursor-pointer group"
            onClick={() => onShortClick?.(shorts, index)}
          >
            <img
              src={short.thumbnail}
              alt={short.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {/* Glass overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center border border-border/20">
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground ml-0.5" />
              </div>
            </div>

            {/* Info */}
            <div className="absolute bottom-0 left-0 right-0 p-1.5 z-10">
              <p className="text-[10px] text-primary-foreground font-medium leading-tight line-clamp-2 drop-shadow-lg">
                {short.title}
              </p>
              <p className="text-[9px] text-primary-foreground/60 mt-0.5 drop-shadow-lg">
                {short.channelTitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
