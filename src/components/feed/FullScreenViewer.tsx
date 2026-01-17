import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { Post } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useColorExtractor } from '@/hooks/useColorExtractor';

interface FullScreenViewerProps {
  posts: Post[];
  initialIndex: number;
  onClose: () => void;
  onLike: (postId: string) => void;
}

export const FullScreenViewer = ({ posts, initialIndex, onClose, onLike }: FullScreenViewerProps) => {
  const [currentPostIndex, setCurrentPostIndex] = useState(initialIndex);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

  const currentPost = posts[currentPostIndex];
  const mediaUrls = currentPost?.media_urls || (currentPost?.image_url ? [currentPost.image_url] : []);
  const currentMediaUrl = mediaUrls[currentMediaIndex];

  const isVideo = (url: string) => {
    return url?.includes('.mp4') || url?.includes('.mov') || url?.includes('.webm');
  };

  // Extract dominant colors from current media
  const { dominantColor, secondaryColor } = useColorExtractor(
    currentMediaUrl,
    isVideo(currentMediaUrl || '')
  );

  useEffect(() => {
    setCurrentMediaIndex(0);
    setIsPlaying(true);
  }, [currentPostIndex]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, currentMediaIndex, currentPostIndex]);

  // Mouse wheel scroll for post navigation with debounce
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (isScrolling) return;
      
      if (Math.abs(e.deltaY) > 30) {
        isScrolling = true;
        
        if (e.deltaY > 0) {
          setCurrentPostIndex(prev => Math.min(prev + 1, posts.length - 1));
        } else {
          setCurrentPostIndex(prev => Math.max(prev - 1, 0));
        }
        
        // Block scrolling for 500ms (like YouTube Shorts)
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 500);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [posts.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp') goToPrevPost();
      if (e.key === 'ArrowDown') goToNextPost();
      if (e.key === 'ArrowLeft') goToPrevMedia();
      if (e.key === 'ArrowRight') goToNextMedia();
      if (e.key === ' ') togglePlay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPostIndex, currentMediaIndex]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const goToNextPost = () => {
    if (currentPostIndex < posts.length - 1) {
      setCurrentPostIndex(prev => prev + 1);
    }
  };

  const goToPrevPost = () => {
    if (currentPostIndex > 0) {
      setCurrentPostIndex(prev => prev - 1);
    }
  };

  const goToNextMedia = () => {
    if (currentMediaIndex < mediaUrls.length - 1) {
      setCurrentMediaIndex(prev => prev + 1);
    }
  };

  const goToPrevMedia = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1);
    }
  };

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };


  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchStartY.current - touchEndY;
    const diffX = touchStartX.current - touchEndX;

    // Prioritize vertical swipe for post navigation
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
      if (diffY > 0) {
        goToNextPost();
      } else {
        goToPrevPost();
      }
    } 
    // Horizontal swipe for media navigation within post
    else if (Math.abs(diffX) > 50 && mediaUrls.length > 1) {
      if (diffX > 0) {
        goToNextMedia();
      } else {
        goToPrevMedia();
      }
    }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Click on left side - previous media, right side - next media, center - toggle play
    if (x < width * 0.3 && mediaUrls.length > 1) {
      goToPrevMedia();
    } else if (x > width * 0.7 && mediaUrls.length > 1) {
      goToNextMedia();
    } else if (isVideo(currentMediaUrl)) {
      togglePlay();
    }
  };

  if (!currentPost) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${dominantColor} 0%, ${secondaryColor} 50%, ${dominantColor} 100%)`
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Blurred background overlay for extra depth */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
          backdropFilter: 'blur(20px)'
        }}
      />
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full bg-black/30 backdrop-blur-sm">
          <X className="h-5 w-5 text-white" />
        </button>
        
        {/* Post counter */}
        <div className="text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full text-white">
          {currentPostIndex + 1} / {posts.length}
        </div>
      </div>

      {/* Media area */}
      <div 
        className="flex-1 flex items-center justify-center relative overflow-hidden z-[1]"
        onClick={handleMediaClick}
      >
        {isVideo(currentMediaUrl) ? (
          <>
            <video
              ref={videoRef}
              src={currentMediaUrl}
              className="max-w-full max-h-full object-contain"
              loop
              playsInline
              autoPlay
            />
            
            {/* Play/Pause overlay */}
            <button 
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className={cn(
                "p-4 rounded-full bg-black/30 backdrop-blur-sm transition-opacity",
                isPlaying ? "opacity-0" : "opacity-100"
              )}>
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-white" />
                ) : (
                  <Play className="h-8 w-8 text-white" />
                )}
              </div>
            </button>
          </>
        ) : (
          <img
            src={currentMediaUrl}
            alt="Post media"
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* Media indicators */}
        {mediaUrls.length > 1 && (
          <>
            {/* Dots */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1.5">
              {mediaUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(index); }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    currentMediaIndex === index ? "bg-white" : "bg-white/40"
                  )}
                />
              ))}
            </div>

            {/* Navigation arrows */}
            {currentMediaIndex > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); goToPrevMedia(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-sm"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
            )}
            {currentMediaIndex < mediaUrls.length - 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); goToNextMedia(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-sm"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Bottom section - Author info and actions */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent p-4 pt-12 z-[1]">
        {/* Author */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10 border-2 border-white/30">
            <AvatarImage src={currentPost.author?.avatar_url} />
            <AvatarFallback className="bg-white/20 text-white">{currentPost.author?.full_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-sm text-white">{currentPost.author?.full_name || 'Foydalanuvchi'}</p>
            <p className="text-xs text-white/70">@{currentPost.author?.username || 'user'}</p>
          </div>
        </div>

        {/* Content */}
        {currentPost.content && (
          <p className="text-sm mb-3 line-clamp-2 text-white/90">{currentPost.content}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 text-white">
          <button 
            onClick={() => onLike(currentPost.id)} 
            className="flex items-center gap-1.5"
          >
            <Heart className="h-6 w-6" />
            <span className="text-sm">{currentPost.likes_count || 0}</span>
          </button>
          <button className="flex items-center gap-1.5">
            <MessageCircle className="h-6 w-6" />
            <span className="text-sm">{currentPost.comments_count || 0}</span>
          </button>
          <button>
            <Share2 className="h-6 w-6" />
          </button>
          <button className="ml-auto">
            <Bookmark className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Swipe indicators */}
      {currentPostIndex > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%] text-white/40 text-xs z-[1]">
          ↑ Oldingi
        </div>
      )}
      {currentPostIndex < posts.length - 1 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[100%] text-white/40 text-xs z-[1]">
          ↓ Keyingi
        </div>
      )}
    </div>
  );
};
