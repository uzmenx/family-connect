import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  userId: string;
  avatarUrl?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
  className?: string;
  hasStory?: boolean;
}

export const UserAvatar = ({ 
  userId, 
  avatarUrl, 
  name, 
  size = 'md',
  clickable = true,
  className,
  hasStory = false
}: UserAvatarProps) => {
  const navigate = useNavigate();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  return (
    <div className={cn(
      'relative inline-block',
      hasStory && 'rounded-full'
    )}>
      {hasStory && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-0.5">
          <div className="w-full h-full rounded-full bg-black" />
        </div>
      )}
      <Avatar 
        className={cn(
          sizeClasses[size],
          !hasStory && "ring-2 ring-primary/20",
          clickable && "cursor-pointer hover:ring-primary/40 transition-all",
          hasStory && "relative z-10",
          className
        )}
        onClick={handleClick}
      >
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="bg-white/20 backdrop-blur-[10px] border border-white/30 text-white text-sm">
          {name?.charAt(0)?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};
