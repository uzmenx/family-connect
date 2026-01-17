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
}

export const UserAvatar = ({ 
  userId, 
  avatarUrl, 
  name, 
  size = 'md',
  clickable = true,
  className 
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
    <Avatar 
      className={cn(
        sizeClasses[size],
        "ring-2 ring-primary/20",
        clickable && "cursor-pointer hover:ring-primary/40 transition-all",
        className
      )}
      onClick={handleClick}
    >
      <AvatarImage src={avatarUrl} />
      <AvatarFallback className="bg-primary/10 text-primary text-sm">
        {name?.charAt(0)?.toUpperCase() || 'U'}
      </AvatarFallback>
    </Avatar>
  );
};
