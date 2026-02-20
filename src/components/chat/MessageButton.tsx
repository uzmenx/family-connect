import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface MessageButtonProps {
  userId: string;
  className?: string;
}

export const MessageButton = ({ userId, className }: MessageButtonProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chat/${userId}`);
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleClick}
      className={`${className} bg-white/10 dark:bg-white/5 border-white/20 hover:bg-white/20 text-foreground h-9 text-sm`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white'
      }}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      Xabar
    </Button>
  );
};
