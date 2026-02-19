import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

interface Short {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export function YouTubeShortsSection() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);
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
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  const handlePlay = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  if (isLoading) {
    return (
      <div className="px-3 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-muted animate-pulse" />
          <div className="w-32 h-4 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[140px] h-[248px] rounded-xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (shorts.length === 0) return null;

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Flame className="w-4 h-4 text-destructive" />
          </div>
          <span className="font-semibold text-sm text-foreground">Shorts</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Shorts Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar px-3 snap-x snap-mandatory"
      >
        {shorts.map((short, index) => (
          <div
            key={short.id}
            className="relative w-[140px] h-[248px] rounded-xl overflow-hidden shrink-0 snap-start bg-card border border-border group cursor-pointer"
            onClick={() => handlePlay(index)}
          >
            {activeIndex === index ? (
              <iframe
                src={`https://www.youtube.com/embed/${short.id}?rel=0&mute=${isMuted ? 1 : 0}&loop=1&playlist=${short.id}&autoplay=1&controls=0&modestbranding=1&playsinline=1`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={short.title}
              />
            ) : (
              <>
                <img
                  src={short.thumbnail}
                  alt={short.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
              <p className="text-[11px] text-white font-medium leading-tight line-clamp-2 drop-shadow-lg">
                {short.title}
              </p>
              <p className="text-[10px] text-white/70 mt-0.5 drop-shadow-lg">
                {short.channelTitle}
              </p>
            </div>

            {activeIndex === index && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center z-20"
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
