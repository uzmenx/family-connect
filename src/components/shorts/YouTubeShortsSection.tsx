import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ChevronLeft, ChevronRight, Flame, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  } catch {return null;}
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

// Rotating search queries for variety — Uzbekistan + world trends
const SEARCH_QUERIES = [
'uzbekistan shorts trending',
'uzbek viral shorts',
'trending shorts worldwide',
'shorts viral funny trending',
'toshkent shorts',
'world trending shorts 2025',
'uzbekistan funny shorts',
'shorts comedy viral'];


function getRandomQuery(): string {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
}

export function YouTubeShortsSection({ onShortClick }: YouTubeShortsProps) {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const currentQueryRef = useRef(getRandomQuery());

  const fetchShorts = useCallback(async (pageToken?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const isFirstLoad = !pageToken;
    if (isFirstLoad) {
      setIsLoading(true);
      // Pick a new random query on each fresh load
      currentQueryRef.current = getRandomQuery();
    } else {
      setIsLoadingMore(true);
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        q: currentQueryRef.current,
        maxResults: '20'
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

      setShorts((prev) => {
        const combined = isFirstLoad ? newShorts : [...prev, ...newShorts];
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = combined.filter((s) => {
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

  // Always fetch fresh shorts on mount (no cache on initial load)
  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  // Expose a refresh method via a custom event so parent can trigger refresh
  useEffect(() => {
    const handler = () => {
      setShorts([]);
      setNextToken(null);
      fetchShorts();
    };
    window.addEventListener('refresh-shorts', handler);
    return () => window.removeEventListener('refresh-shorts', handler);
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
      behavior: 'smooth'
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
          {[...Array(4)].map((_, i) =>
          <div key={i} className="w-[110px] h-[196px] rounded-2xl bg-muted/30 animate-pulse shrink-0" />
          )}
        </div>
      </div>);

  }

  if (shorts.length === 0) return null;

  return (
    <div className="pt-1 pb-0">
      {/* Header */}
      <div className="items-center justify-between mb-1.5 px-[12px] flex flex-row py-[3px]">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Flame className="w-3.5 h-3.5 text-destructive" />
          <span className="font-semibold text-xs text-foreground">Shorts</span>
          
        </div>
        <div className="flex-1 px-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              className="h-7 rounded-full pl-8 pr-3 bg-background/30 border-white/10 backdrop-blur-xl text-xs focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => scroll('left')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20">

            <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-6 h-6 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/20">

            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      {/* Hide scrollbar CSS */}
      <style>{`.shorts-carousel::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={scrollRef}
        className="shorts-carousel flex gap-2 overflow-x-auto px-3 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>

        {shorts.map((short, index) =>
        <div
          key={`${short.id}-${index}`}
          className="relative w-[110px] h-[196px] rounded-2xl overflow-hidden shrink-0 snap-start cursor-pointer group"
          onClick={() => onShortClick?.(shorts, index)}>

            <img
            src={short.thumbnail}
            alt={short.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            
            <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-background/20 backdrop-blur-md flex items-center justify-center border border-border/20">
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground ml-0.5" />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-1.5 z-10">
              <p className="text-[10px] font-medium leading-tight line-clamp-2 drop-shadow-lg bg-inherit text-gray-300">
                {short.title}
              </p>
              <p className="text-[9px] text-primary-foreground/60 mt-0.5 drop-shadow-lg">
                {short.channelTitle}
              </p>
            </div>
          </div>
        )}

        {/* Loader sentinel for infinite scroll */}
        <div ref={loaderRef} className="flex items-center justify-center shrink-0 w-[60px]">
          {isLoadingMore ?
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /> :
          nextToken ?
          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" /> :

          <p className="text-[9px] text-muted-foreground whitespace-nowrap">Hammasi ✓</p>
          }
        </div>
      </div>
    </div>);

}