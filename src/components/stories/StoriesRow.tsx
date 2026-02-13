import { useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStories, StoryGroup } from "@/hooks/useStories";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StoriesRowProps {
  onStoryClick: (groupIndex: number, storyIndex?: number) => void;
}

export const StoriesRow = ({ onStoryClick }: StoriesRowProps) => {
  const { storyGroups, isLoading } = useStories();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  // Check if current user has stories
  const myStoryGroup = storyGroups.find((g) => g.user_id === user?.id);
  const otherGroups = storyGroups.filter((g) => g.user_id !== user?.id);

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) =>
          <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="w-12 h-3 bg-muted animate-pulse rounded" />
            </div>
          )}
        </div>
      </div>);

  }

  if (storyGroups.length === 0 && !user) {
    return null;
  }

  return (
    <div className="relative border-b border-border">
      {/* Scroll buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm hidden sm:flex"
        onClick={() => scroll("left")}>

        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm hidden sm:flex"
        onClick={() => scroll("right")}>

        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Stories scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide px-4 gap-[3px] py-[3px] flex items-start justify-start"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

        {/* Add story / My story button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative">
            {myStoryGroup ?
            <StoryAvatar
              group={myStoryGroup}
              onClick={() => {
                const index = storyGroups.findIndex((g) => g.user_id === user?.id);
                onStoryClick(index);
              }}
              isOwn /> :


            <button
              onClick={() => navigate("/create-story")}
              className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors">

                {profile?.avatar_url ?
              <img
                src={profile.avatar_url}
                alt="You"
                className="w-full h-full rounded-full object-cover opacity-70" /> :


              <Plus className="h-6 w-6 text-muted-foreground" />
              }
              </button>
            }
            {/* Add button overlay for own story */}
            {!myStoryGroup &&
            <button
              onClick={() => navigate("/create-story")}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-background">

                <Plus className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            }
          </div>
          <span className="text-xs text-muted-foreground truncate w-16 text-center">
            {myStoryGroup ? "Hikoyangiz" : "Qo'shish"}
          </span>
        </div>

        {/* Other users' stories */}
        {otherGroups.map((group) => {
          const groupIndex = storyGroups.findIndex((g) => g.user_id === group.user_id);
          return <StoryAvatar key={group.user_id} group={group} onClick={() => onStoryClick(groupIndex)} />;
        })}
      </div>
    </div>);

};

interface StoryAvatarProps {
  group: StoryGroup;
  onClick: () => void;
  isOwn?: boolean;
}

const StoryAvatar = ({ group, onClick, isOwn }: StoryAvatarProps) => {
  const displayName = group.user.name || group.user.username || "Foydalanuvchi";

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <button
        onClick={onClick}
        className={cn(
          "w-16 h-16 rounded-full p-0.5",
          group.has_unviewed ?
          "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" :
          "bg-muted-foreground/30"
        )}>

        <div className="w-full h-full rounded-full bg-background p-0.5">
          {group.user.avatar_url ?
          <img src={group.user.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" /> :

          <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
          }
        </div>
      </button>
      <span className="text-xs text-foreground truncate w-16 text-center">
        {isOwn ? "Sizning" : displayName.substring(0, 10)}
      </span>
    </div>);

};