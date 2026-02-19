import { useState, useRef, useEffect } from 'react';
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
  onClose,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
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

  const bgStyle = activeTab === 'posts' && dominantColor
    ? { background: `linear-gradient(135deg, ${dominantColor} 0%, ${secondaryColor} 50%, ${dominantColor} 100%)` }
    : { background: '#000' };

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsPlaying(true);
  }, [postIndex, shortIndex, activeTab]);

  useEffect(() => {
    if (videoRef.current) {
      isPlaying ? videoRef.current.play().catch(() => {}) : videoRef.current.pause();
    }
  }, [isPlaying, currentMediaIndex, postIndex]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const itemCount = activeTab === 'posts' ? posts.length : shorts.length;
  const currentIndex = activeTab === 'posts' ? postIndex : shortIndex;
  const setCurrentIndex = activeTab === 'posts' ? setPostIndex : setShortIndex;

  const smoothNavigate = (direction: 'up' | 'down') => {
    if (isTransitioning) return;
    const canGo = direction === 'down' ? currentIndex < itemCount - 1 : currentIndex > 0;
    if (!canGo) return;

    setIsTransitioning(true);
    setSlideDirection(direction);

    setTimeout(() => {
      setCurrentIndex(prev => direction === 'down' ? prev + 1 : prev - 1);
      setTimeout(() => {
        setSlideDirection(null);
        setIsTransitioning(false);
      }, 300);
    }, 200);
  };

  // Wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let isScrolling = false;
    let timeout: NodeJS.Timeout;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isScrolling || isTransitioning) return;
      if (Math.abs(e.deltaY) > 30) {
        isScrolling = true;
        smoothNavigate(e.deltaY > 0 ? 'down' : 'up');
        timeout = setTimeout(() => { isScrolling = false; }, 600);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => { container.removeEventListener('wheel', handleWheel); clearTimeout(timeout); };
  }, [itemCount, isTransitioning, currentIndex, activeTab]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') smoothNavigate('down');
      if (e.key === 'ArrowUp') smoothNavigate('up');
      if (e.key === 'ArrowLeft') currentMediaIndex > 0 && setCurrentMediaIndex(p => p - 1);
      if (e.key === 'ArrowRight') currentMediaIndex < mediaUrls.length - 1 && setCurrentMediaIndex(p => p + 1);
      if (e.key === ' ') setIsPlaying(p => !p);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, currentMediaIndex, activeTab]);

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
      smoothNavigate(diffY > 0 ? 'down' : 'up');
    } else if (Math.abs(diffX) > 50 && mediaUrls.length > 1) {
      diffX > 0 ? setCurrentMediaIndex(p => Math.min(p + 1, mediaUrls.length - 1)) : setCurrentMediaIndex(p => Math.max(p - 1, 0));
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
        setIsPlaying(p => !p);
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
        <iframe
          src={`https://www.youtube.com/embed/${currentShort.id}?rel=0&autoplay=1&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${currentShort.id}`}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={currentShort.title}
        />
        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-16 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 pt-10 z-[2]">
          <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-2">{currentShort.title}</p>
          <p className="text-xs text-white/60 mt-1">{currentShort.channelTitle}</p>
        </div>
      </div>
    );
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
          onClick={handleMediaClick}
        >
          {isVideo(currentMediaUrl) ? (
            <>
              <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-full object-contain" loop playsInline autoPlay />
              <button onClick={(e) => { e.stopPropagation(); setIsPlaying(p => !p); }} className="absolute inset-0 flex items-center justify-center">
                <div className={cn("p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity", isPlaying ? "opacity-0" : "opacity-100")}>
                  {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
                </div>
              </button>
            </>
          ) : (
            <img src={currentMediaUrl} alt="Post media" className="max-w-full max-h-full object-contain" />
          )}

          {showDoubleTapHeart && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Heart className="h-24 w-24 text-white fill-white drop-shadow-lg animate-heartBurst" />
            </div>
          )}

          {/* Multi-media dots */}
          {mediaUrls.length > 1 && (
            <>
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaUrls.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(i); }}
                    className={cn("w-2 h-2 rounded-full transition-colors", currentMediaIndex === i ? "bg-white" : "bg-white/40")} />
                ))}
              </div>
              {currentMediaIndex > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p - 1); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 backdrop-blur-sm rounded-2xl">
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
              )}
              {currentMediaIndex < mediaUrls.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p + 1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 backdrop-blur-sm rounded-2xl">
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="absolute right-3 bottom-28 z-[2]">
          <FullscreenActions
            postId={currentPost.id}
            initialLikesCount={currentPost.likes_count}
            initialCommentsCount={currentPost.comments_count}
            videoUrl={isVideo(currentMediaUrl) ? currentMediaUrl : undefined}
            onOpenVideoPlayer={(url) => {
              setVideoPlayerSrc(url);
              setShowVideoPlayer(true);
              if (videoRef.current) videoRef.current.pause();
              setIsPlaying(false);
            }}
          />
        </div>

        {/* Author info */}
        <div className="absolute bottom-0 left-0 right-16 bg-gradient-to-t from-black/70 via-black/50 to-transparent p-4 pt-12 z-[1] mb-[61px]">
          <div className="flex items-center mb-3 gap-2">
            <UserAvatar userId={currentPost.user_id} avatarUrl={currentPost.author?.avatar_url} name={currentPost.author?.full_name} size="lg" className="border-2 border-white/30 ring-0" />
            <UserInfo userId={currentPost.user_id} name={currentPost.author?.full_name} username={currentPost.author?.username} variant="fullscreen" />
            <FollowButton targetUserId={currentPost.user_id} size="sm" />
          </div>
          {currentPost.content && <PostCaption content={currentPost.content} variant="fullscreen" />}
        </div>
      </>
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden"
        style={bgStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 'posts' && (
          <div className="absolute inset-0 z-0" style={{
            background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
            backdropFilter: 'blur(20px)'
          }} />
        )}

        {/* Top bar with tabs */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Tabs - glass pills */}
          <div className="flex gap-1 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10">
            <button
              onClick={() => handleTabSwitch('shorts')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                activeTab === 'shorts'
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/60 hover:text-white/80"
              )}
            >
              yt shorts
            </button>
            <button
              onClick={() => handleTabSwitch('posts')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                activeTab === 'posts'
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/60 hover:text-white/80"
              )}
            >
              postlar
            </button>
          </div>

          <div className="w-8" /> {/* spacer */}
        </div>

        {/* Content */}
        {activeTab === 'shorts' ? renderShort() : renderPost()}
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[60] w-full h-full min-h-[100dvh] overflow-hidden bg-black" style={{ height: '100dvh' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)}
          />
        </div>,
        document.body
      )}
    </>
  );
};
