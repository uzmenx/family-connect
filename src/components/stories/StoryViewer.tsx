import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Send, Eye, MoreVertical, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StoryGroup, Story, useStories } from '@/hooks/useStories';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex?: number;
  onClose: () => void;
}

export const StoryViewer = ({
  storyGroups,
  initialGroupIndex,
  initialStoryIndex = 0,
  onClose,
}: StoryViewerProps) => {
  const { user } = useAuth();
  const { recordView, toggleLike, getStoryViewers, getStoryLikers } = useStories();
  const { getOrCreateConversation } = useConversations();
  
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [likers, setLikers] = useState<any[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<number>(0);

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = currentStory?.user_id === user?.id;
  const storyDuration = currentStory?.media_type === 'video' ? 15000 : 5000;

  // Record view when story changes
  useEffect(() => {
    if (currentStory && !isOwnStory) {
      recordView(currentStory.id);
    }
    setIsLiked(currentStory?.has_liked || false);
  }, [currentStory, isOwnStory, recordView]);

  // Load viewers/likers for own story
  useEffect(() => {
    if (isOwnStory && currentStory) {
      loadViewersAndLikers();
    }
  }, [currentStory, isOwnStory]);

  const loadViewersAndLikers = async () => {
    if (!currentStory) return;
    const [viewersData, likersData] = await Promise.all([
      getStoryViewers(currentStory.id),
      getStoryLikers(currentStory.id),
    ]);
    setViewers(viewersData);
    setLikers(likersData);
  };

  // Progress timer
  useEffect(() => {
    if (isPaused || !currentStory) return;

    progressRef.current = 0;
    setProgress(0);

    const interval = 50; // Update every 50ms
    timerRef.current = setInterval(() => {
      progressRef.current += interval;
      setProgress((progressRef.current / storyDuration) * 100);

      if (progressRef.current >= storyDuration) {
        goToNext();
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStory, isPaused, storyDuration, goToNext]);

  const goToNext = useCallback(() => {
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  }, [currentStoryIndex, currentGroup, currentGroupIndex, storyGroups.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = storyGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
    }
  }, [currentStoryIndex, currentGroupIndex, storyGroups]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      goToPrev();
    } else if (x > width * 0.7) {
      goToNext();
    } else {
      setIsPaused(prev => !prev);
    }
  };

  const handleLike = async () => {
    if (!currentStory) return;
    await toggleLike(currentStory.id, isLiked);
    setIsLiked(!isLiked);
  };

  const timeAgo = currentStory
    ? formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })
    : '';

  if (!currentGroup || !currentStory) {
    return null;
  }

  const author = currentStory.author || currentGroup.user;

  const handleVideoEnded = useCallback(() => {
    goToNext();
  }, [goToNext]);

  return (
    <div className="fullscreen-story-view flex flex-col">
      {/* Story content */}
      <div
        className="relative flex-1 w-full min-h-0 flex items-center justify-center touch-none"
        onClick={handleTap}
      >
        {currentStory.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="max-w-full max-h-full w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            playsInline
            loop={false}
            onEnded={handleVideoEnded}
          />
        ) : (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="max-w-full max-h-full w-full h-full object-contain"
          />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none" />

        {/* Progress bars — safe-area ichida */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 pt-[max(8px,env(safe-area-inset-top))] px-2">
          {currentGroup.stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    index < currentStoryIndex
                      ? '100%'
                      : index === currentStoryIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header — safe-area */}
        <div className="absolute top-[max(24px,calc(8px+env(safe-area-inset-top)))] left-0 right-0 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt={author.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-white font-medium">
                  {(author.name || author.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-white">
              <p className="font-medium text-sm">{author.name || author.username || 'Foydalanuvchi'}</p>
              <p className="text-xs opacity-70">{timeAgo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStory.media_type === 'video' && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(!isPaused);
              }}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-[max(80px,calc(64px+env(safe-area-inset-bottom)))] left-4 right-4">
            <p className="text-white text-center text-sm bg-black/40 px-3 py-2 rounded-lg">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Footer actions — safe-area */}
        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-4 right-4">
          {isOwnStory ? (
            // Own story: show viewers
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20 gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowViewers(true);
                setIsPaused(true);
              }}
            >
              <Eye className="h-5 w-5" />
              <span>{viewers.length} ko'rish</span>
            </Button>
          ) : (
            // Other's story: reply & like
            <div className="flex items-center gap-2">
              <Input
                placeholder={`${author.username || 'Foydalanuvchi'}ga javob...`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(true);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-white hover:bg-white/20",
                  isLiked && "text-red-500"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
              >
                <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                disabled={!reply.trim()}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!reply.trim() || !currentStory) return;
                  try {
                    const convId = await getOrCreateConversation(currentStory.user_id);
                    if (!convId || !user?.id) return;
                    const storyReplyText = `📷 Story'ga javob:\n${reply.trim()}`;
                    await supabase.from('messages').insert({
                      conversation_id: convId,
                      sender_id: user.id,
                      content: storyReplyText,
                      status: 'sent',
                    });
                    toast.success("Javob yuborildi");
                    setReply('');
                  } catch (err) {
                    console.error('Story reply error:', err);
                    toast.error("Xatolik yuz berdi");
                  }
                }}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation buttons (desktop) */}
        {currentGroupIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}
        {currentGroupIndex < storyGroups.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Viewers sheet */}
      <Sheet open={showViewers} onOpenChange={(open) => {
        setShowViewers(open);
        if (!open) setIsPaused(false);
      }}>
        <SheetContent side="bottom" className="h-[60vh]">
          <SheetHeader>
            <SheetTitle>Ko'rganlar ({viewers.length})</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full mt-4">
            <div className="space-y-3">
              {viewers.map((viewer) => (
                <div key={viewer.viewer_id} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                    {viewer.profile?.avatar_url ? (
                      <img
                        src={viewer.profile.avatar_url}
                        alt={viewer.profile.name || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {(viewer.profile?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {viewer.profile?.name || viewer.profile?.username || 'Foydalanuvchi'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{viewer.profile?.username || 'user'}
                    </p>
                  </div>
                  {likers.some(l => l.user_id === viewer.viewer_id) && (
                    <Heart className="h-4 w-4 text-red-500 fill-current" />
                  )}
                </div>
              ))}
              {viewers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Hali hech kim ko'rmagan
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};
