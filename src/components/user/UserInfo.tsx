import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UserInfoProps {
  userId: string;
  name?: string;
  username?: string;
  variant?: 'default' | 'fullscreen';
  clickable?: boolean;
  className?: string;
}

export const UserInfo = ({ 
  userId, 
  name, 
  username, 
  variant = 'default',
  clickable = true,
  className 
}: UserInfoProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  if (variant === 'fullscreen') {
    return (
      <div 
        className={cn(
          "flex-1",
          clickable && "cursor-pointer",
          className
        )}
        onClick={handleClick}
      >
        <p className="font-semibold text-sm text-white hover:underline">
          {name || 'Foydalanuvchi'}
        </p>
        <p className="text-xs text-white/70">@{username || 'user'}</p>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        clickable && "cursor-pointer",
        className
      )}
      onClick={handleClick}
    >
      <p className="font-semibold text-sm hover:underline">
        {name || 'Foydalanuvchi'}
      </p>
      <p className="text-xs text-muted-foreground">@{username || 'user'}</p>
    </div>
  );
};
