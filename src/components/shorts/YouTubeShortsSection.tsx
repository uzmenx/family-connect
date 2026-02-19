import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ChevronLeft, ChevronRight, Flame, Loader2 } from 'lucide-react';

export interface Short {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface YouTubeShortsProps {
  onShortClick?: (shorts: Short[], index: number) => void;
}

const CACHE_KEY = 'yt_shorts_cache_v2';
const TOKEN_KEY = 'shorts_next_token_v2';
const CACHE_TTL = 1800000; // 30 min

interface CacheData {
  shorts: Short[];
  nextPageToken: string | null;
  timestamp: number;
}

function loadCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheData = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveCache(shorts: Short[], nextPageToken: string | null) {
  try {
    const data: CacheData = { shorts, nextPageToken, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    if (nextPageToken) {
      localStorage.setItem(TOKEN_KEY, nextPageToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function YouTubeShortsSection({ onShortClick }: YouTubeShortsProps) {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const fetchShorts = useCallback(async (pageToken?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const isFirstLoad = !pageToken;
    if (isFirstLoad) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        q: 'shorts trending viral funny',
        maxResults: '20',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-shorts?${params}`,
        { headers: { apikey: anonKey } }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const newShorts: Short[] = data?.shorts || [];
      const newToken: string | null = data?.nextPageToken || null;

      setShorts(prev => {
        const combined = isFirstLoad ? newShorts : [...prev, ...newShorts];
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = combined.filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        saveCache(unique, newToken);
        return unique;
      });
      setNextToken(newToken);
    } catch (err) {
      console.error('Failed to fetch shorts:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

  // Load from cache or fetch on mount
  useEffect(() => {
    const cached = loadCache();
    if (cached && cached.shorts.length > 0) {
      setShorts(cached.shorts);
      setNextToken(cached.nextPageToken);
      setIsLoading(false);
    } else {
      fetchShorts();
    }
  }, [fetchShorts]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextToken && !isLoadingMore && !fetchingRef.current) {
          fetchShorts(nextToken);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextToken, isLoadingMore, fetchShorts]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -240 : 240,
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
    <div className="pt-1 pb-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-destructive" />
          <span className="font-semibold text-xs text-foreground">Shorts</span>
          <span className="text-[10px] text-muted-foreground">({shorts.length})</span>
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

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-3 snap-x snap-mandatory"
      >
        {shorts.map((short, index) => (
          <div
            key={`${short.id}-${index}`}
            className="relative w-[110px] h-[196px] rounded-2xl overflow-hidden shrink-0 snap-start cursor-pointer group"
            onClick={() => onShortClick?.(shorts, index)}
          >
            <img
              src={short.thumbnail}
              alt={short.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            
            <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center border border-border/20">
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground ml-0.5" />
              </div>
            </div>

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

        {/* Loader sentinel for infinite scroll */}
        <div ref={loaderRef} className="flex items-center justify-center shrink-0 w-[60px]">
          {isLoadingMore ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : nextToken ? (
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
          ) : (
            <p className="text-[9px] text-muted-foreground whitespace-nowrap">Hammasi ✓</p>
          )}
        </div>
      </div>
    </div>
  );
}
