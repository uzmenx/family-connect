import { Button } from '@/components/ui/button';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export const FollowButton = ({ targetUserId, size = 'default', className }: FollowButtonProps) => {
  const { user } = useAuth();
  const { isFollowing, isLoading, toggleFollow } = useFollow(targetUserId);

  // Don't show button if viewing own profile
  if (user?.id === targetUserId) return null;

  return (
    <Button
      variant={isFollowing ? "default" : "outline"}
      size={size}
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow();
      }}
      disabled={isLoading || !user}
      className={cn(
        "min-w-[100px] transition-all",
        isFollowing 
          ? "bg-primary hover:bg-primary/90" 
          : "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        "Kuzatilmoqda"
      ) : (
        "Kuzatish"
      )}
    </Button>
  );
};
