import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PostCaptionProps {
  username?: string;
  content: string;
  className?: string;
  variant?: 'default' | 'fullscreen';
}

export const PostCaption = ({ username, content, className, variant = 'default' }: PostCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if content is long enough to need truncation
  const shouldTruncate = content.length > 100;
  
  // Extract and highlight hashtags
  const renderContent = (text: string) => {
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const isFullscreen = variant === 'fullscreen';

  return (
    <div className={cn("text-sm", className)}>
      {username && !isFullscreen && (
        <span className="font-semibold mr-1">{username}</span>
      )}
      
      <span className={cn(
        isFullscreen ? "text-white/90" : "text-foreground",
        !isExpanded && shouldTruncate && "line-clamp-2"
      )}>
        {renderContent(content)}
      </span>
      
      {shouldTruncate && !isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className={cn(
            "ml-1 font-medium",
            isFullscreen ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          ko'proq
        </button>
      )}
      
      {shouldTruncate && isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className={cn(
            "ml-1 font-medium",
            isFullscreen ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          yig'ish
        </button>
      )}
    </div>
  );
};
