import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { useColorExtractor } from '@/hooks/useColorExtractor';
import { FullscreenActions } from '@/components/post/FullscreenActions';
import { PostCaption } from '@/components/post/PostCaption';
import { usePostLikes } from '@/hooks/usePostLikes';
import { UserAvatar } from '@/components/user/UserAvatar';
import { UserInfo } from '@/components/user/UserInfo';
import { FollowButton } from '@/components/user/FollowButton';
import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';
import type { Short } from '@/components/shorts/YouTubeShortsSection';

type TabType = 'shorts' | 'posts';

interface UnifiedFullScreenViewerProps {
  posts: Post[];
  shorts: Short[];
  initialTab: TabType;
  initialIndex: number;
  onClose: () => void;
}

export const UnifiedFullScreenViewer = ({
  posts,
  shorts,
  initialTab,
  initialIndex,
  onClose
}: UnifiedFullScreenViewerProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [postIndex, setPostIndex] = useState(initialTab === 'posts' ? initialIndex : 0);
  const [shortIndex, setShortIndex] = useState(initialTab === 'shorts' ? initialIndex : 0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down' | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoPlayerSrc, setVideoPlayerSrc] = useState('');
  const [shortsPlaying, setShortsPlaying] = useState(true);
  const [shortsIframeKey, setShortsIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const lastTapRef = useRef(0);

  const currentPost = activeTab === 'posts' ? posts[postIndex] : null;
  const currentShort = activeTab === 'shorts' ? shorts[shortIndex] : null;

  const mediaUrls = currentPost?.media_urls || (currentPost?.image_url ? [currentPost.image_url] : []);
  const currentMediaUrl = mediaUrls[currentMediaIndex];

  const { isLiked, toggleLike } = usePostLikes(currentPost?.id || '');

  const isVideo = (url?: string) => url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');

  const { dominantColor, secondaryColor } = useColorExtractor(
    activeTab === 'posts' ? currentMediaUrl : undefined,
    isVideo(currentMediaUrl)
  );

  const bgStyle = activeTab === 'posts' && dominantColor ?
  { background: `linear-gradient(135deg, ${dominantColor} 0%, ${secondaryColor} 50%, ${dominantColor} 100%)` } :
  { background: '#000' };

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsPlaying(true);
    setShortsPlaying(true);
    setShortsIframeKey((k) => k + 1);
  }, [postIndex, shortIndex, activeTab]);

  useEffect(() => {
    if (videoRef.current) {
      isPlaying ? videoRef.current.play().catch(() => {}) : videoRef.current.pause();
    }
  }, [isPlaying, currentMediaIndex, postIndex]);

  useEffect(() => {
    if (activeTab === 'shorts') {
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeTab]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = '';};
  }, []);

  const itemCount = activeTab === 'posts' ? posts.length : shorts.length;
  const currentIndex = activeTab === 'posts' ? postIndex : shortIndex;
  const setCurrentIndex = activeTab === 'posts' ? setPostIndex : setShortIndex;

  const smoothNavigate = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning) return;
    const idx = activeTab === 'posts' ? postIndex : shortIndex;
    const count = activeTab === 'posts' ? posts.length : shorts.length;
    const canGo = direction === 'down' ? idx < count - 1 : idx > 0;
    if (!canGo) return;

    setIsTransitioning(true);
    setSlideDirection(direction);

    setTimeout(() => {
      if (activeTab === 'posts') {
        setPostIndex((prev) => direction === 'down' ? prev + 1 : prev - 1);
      } else {
        setShortIndex((prev) => direction === 'down' ? prev + 1 : prev - 1);
      }
      setTimeout(() => {
        setSlideDirection(null);
        setIsTransitioning(false);
      }, 250);
    }, 150);
  }, [isTransitioning, activeTab, postIndex, shortIndex, posts.length, shorts.length]);

  // Wheel - with proper deps
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isScrolling = false;
    let timeout: NodeJS.Timeout;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isScrolling || isTransitioning) return;
      if (Math.abs(e.deltaY) > 20) {
        isScrolling = true;
        smoothNavigate(e.deltaY > 0 ? 'down' : 'up');
        timeout = setTimeout(() => {isScrolling = false;}, 500);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {container.removeEventListener('wheel', handleWheel);clearTimeout(timeout);};
  }, [smoothNavigate, isTransitioning]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') smoothNavigate('down');
      if (e.key === 'ArrowUp') smoothNavigate('up');
      if (e.key === 'ArrowLeft') currentMediaIndex > 0 && setCurrentMediaIndex((p) => p - 1);
      if (e.key === 'ArrowRight') currentMediaIndex < mediaUrls.length - 1 && setCurrentMediaIndex((p) => p + 1);
      if (e.key === ' ') {e.preventDefault();setIsPlaying((p) => !p);}
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [smoothNavigate, currentMediaIndex, mediaUrls.length, onClose]);

  // Touch - improved with velocity detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const elapsed = Date.now() - touchStartTime.current;
    const velocityY = Math.abs(diffY) / Math.max(elapsed, 1);

    // Lower threshold for fast swipes
    const threshold = velocityY > 0.5 ? 30 : 60;

    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > threshold) {
      smoothNavigate(diffY > 0 ? 'down' : 'up');
    } else if (Math.abs(diffX) > 40 && mediaUrls.length > 1) {
      diffX > 0 ? setCurrentMediaIndex((p) => Math.min(p + 1, mediaUrls.length - 1)) : setCurrentMediaIndex((p) => Math.max(p - 1, 0));
    }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    if (activeTab === 'shorts') return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowDoubleTapHeart(true);
      if (!isLiked) toggleLike();
      setTimeout(() => setShowDoubleTapHeart(false), 1000);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current !== 0 && isVideo(currentMediaUrl)) {
        setIsPlaying((p) => !p);
      }
    }, 350);
  };

  const handleTabSwitch = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setCurrentMediaIndex(0);
  };

  // ─── RENDER: Shorts tab ───
  const renderShort = () => {
    if (!currentShort) return null;
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center relative overflow-hidden z-[1] transition-all duration-300 ease-out",
        slideDirection === 'down' && "animate-slide-out-up",
        slideDirection === 'up' && "animate-slide-out-down",
        !slideDirection && "animate-slide-in"
      )}>
        {/* YouTube iframe with top overlay to hide YT controls */}
        <div className="relative w-full h-full pointer-events-none">
          {shorts.slice(shortIndex + 1, shortIndex + 4).map((s) => (
            <iframe
              key={`preload-${s.id}`}
              src={`https://www.youtube.com/embed/${s.id}?rel=0&autoplay=1&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${s.id}&showinfo=0&iv_load_policy=3&disablekb=1&fs=0`}
              className="absolute inset-0 w-full h-full opacity-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={s.title} />
          ))}
          <iframe
            key={`${currentShort.id}-${shortsIframeKey}-${shortsPlaying ? 'p' : 's'}`}
            src={`https://www.youtube.com/embed/${currentShort.id}?rel=0&autoplay=${shortsPlaying ? 1 : 0}&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${currentShort.id}&showinfo=0&iv_load_policy=3&disablekb=1&fs=0`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={currentShort.title} />
          {/* Cover YouTube's top overlay (profile, title, playlist, 3-dot) */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black via-black/80 to-transparent z-[3] pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={() => {
            setShortsPlaying((p) => !p);
            setShortsIframeKey((k) => k + 1);
          }}
          className="absolute inset-0 z-[4] flex items-center justify-center pointer-events-auto"
          aria-label={shortsPlaying ? 'Pause' : 'Play'}>
          <div className={cn(
            "p-4 rounded-full bg-black/35 backdrop-blur-sm border border-white/10 transition-opacity",
            shortsPlaying ? "opacity-0" : "opacity-100"
          )}>
            {shortsPlaying ?
            <Pause className="h-8 w-8 text-white" /> :
            <Play className="h-8 w-8 text-white" />}
          </div>
        </button>

        {/* Bottom info - minimalist */}
        <div className="absolute bottom-14 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-4 pt-16 z-[2]">
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 drop-shadow-lg">
                {currentShort.title}
              </p>
              <p className="text-[11px] text-white/50 mt-1 drop-shadow">{currentShort.channelTitle}</p>
            </div>

            {/* YouTube logo indicator */}
            <div className="shrink-0 flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-red-500 fill-current">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" className="fill-white" />
              </svg>
              <span className="text-[10px] text-white/70 font-medium">Shorts</span>
            </div>
          </div>
        </div>

        {/* Position indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-[3]">
          {shorts.map((_, i) =>
          <div key={i} className={cn("w-1 rounded-full transition-all duration-300 opacity-0",

          i === shortIndex ? "h-4 bg-white/80" : "h-1.5 bg-white/20"
          )} />
          )}
        </div>
      </div>);

  };

  // ─── RENDER: Posts tab ───
  const renderPost = () => {
    if (!currentPost) return null;
    return (
      <>
        <div
          className={cn(
            "flex-1 flex items-center justify-center relative overflow-hidden z-[1] transition-all duration-300 ease-out",
            slideDirection === 'down' && "animate-slide-out-up",
            slideDirection === 'up' && "animate-slide-out-down",
            !slideDirection && "animate-slide-in"
          )}
          onClick={handleMediaClick}>

          {isVideo(currentMediaUrl) ?
          <>
              <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-full object-contain" loop playsInline autoPlay />
              <button onClick={(e) => {e.stopPropagation();setIsPlaying((p) => !p);}} className="absolute inset-0 flex items-center justify-center">
                <div className={cn("p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity", isPlaying ? "opacity-0" : "opacity-100")}>
                  {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
                </div>
              </button>
            </> :

          <img src={currentMediaUrl} alt="Post media" className="max-w-full max-h-full object-contain" />
          }

          {showDoubleTapHeart &&
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Heart className="h-24 w-24 text-white fill-white drop-shadow-lg animate-heartBurst" />
            </div>
          }

          {/* Multi-media dots */}
          {mediaUrls.length > 1 &&
          <>
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaUrls.map((_, i) =>
              <button key={i} onClick={(e) => {e.stopPropagation();setCurrentMediaIndex(i);}}
              className={cn("w-1.5 h-1.5 rounded-full transition-colors", currentMediaIndex === i ? "bg-white" : "bg-white/30")} />
              )}
              </div>
              {currentMediaIndex > 0 &&
            <button onClick={(e) => {e.stopPropagation();setCurrentMediaIndex((p) => p - 1);}}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/20 backdrop-blur-sm rounded-full">
                  <ChevronLeft className="h-4 w-4 text-white" />
                </button>
            }
              {currentMediaIndex < mediaUrls.length - 1 &&
            <button onClick={(e) => {e.stopPropagation();setCurrentMediaIndex((p) => p + 1);}}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/20 backdrop-blur-sm rounded-full">
                  <ChevronRight className="h-4 w-4 text-white" />
                </button>
            }
            </>
          }
        </div>

        {/* Actions */}
        <div className="absolute right-3 bottom-24 z-[2]">
          <FullscreenActions
            postId={currentPost.id}
            initialLikesCount={currentPost.likes_count}
            initialCommentsCount={currentPost.comments_count}
            initialViewsCount={currentPost.views_count ?? 0}
            videoUrl={isVideo(currentMediaUrl) ? currentMediaUrl : undefined}
            onOpenVideoPlayer={(url) => {
              setVideoPlayerSrc(url);
              setShowVideoPlayer(true);
              if (videoRef.current) videoRef.current.pause();
              setIsPlaying(false);
            }} />

        </div>

        {/* Author info */}
        <div className="absolute bottom-14 left-0 right-14 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-14 z-[1]">
          <div className="flex items-center mb-2 gap-2">
            <UserAvatar userId={currentPost.user_id} avatarUrl={currentPost.author?.avatar_url} name={currentPost.author?.full_name} size="lg" className="border-2 border-white/20 ring-0" />
            <UserInfo userId={currentPost.user_id} name={currentPost.author?.full_name} username={currentPost.author?.username} variant="fullscreen" />
            <FollowButton targetUserId={currentPost.user_id} size="sm" />
          </div>
          {currentPost.content && <PostCaption content={currentPost.content} variant="fullscreen" />}
        </div>
      </>);

  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden touch-none"
        style={bgStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>

        {activeTab === 'posts' && dominantColor &&
        <div className="absolute inset-0 z-0" style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
          backdropFilter: 'blur(20px)'
        }} />
        }

        {/* Top bar with tabs */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-[env(safe-area-inset-top,10px)] pb-2 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 my-0">
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10 py-[2px] my-[10px]">
            <button
              onClick={() => handleTabSwitch('shorts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'shorts' ?
                "bg-white/20 text-white shadow-sm" :
                "text-white/50 hover:text-white/70"
              )}>

              yt shorts
            </button>
            <button
              onClick={() => handleTabSwitch('posts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'posts' ?
                "bg-white/20 text-white shadow-sm" :
                "text-white/50 hover:text-white/70"
              )}>

              postlar
            </button>
          </div>

          <div className="w-7" />
        </div>

        {/* Content */}
        {activeTab === 'shorts' ? renderShort() : renderPost()}
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[80] w-full h-full min-h-[100dvh] overflow-hidden bg-black" style={{ height: '100dvh' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)} />

        </div>,
        document.body
      )}
    </>);
};