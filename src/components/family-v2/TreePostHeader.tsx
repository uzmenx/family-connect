import { Menu, Plus, Save, Send, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TreePostHeaderProps {
  onOpenHistory: () => void;
  onCreateNew: () => void;
  onSave: () => void;
  onPublish: () => void;
  onFullscreen: () => void;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
}

export const TreePostHeader = ({
  onOpenHistory,
  onCreateNew,
  onSave,
  onPublish,
  onFullscreen,
  isSaving,
  hasCurrentPost,
}: TreePostHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm border-b border-border z-10">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenHistory} className="h-9 w-9">
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCreateNew} className="h-9 w-9">
          <Plus className="h-5 w-5" />
        </Button>
        {hasCurrentPost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 w-9"
          >
            <Save className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onFullscreen} className="h-9 w-9">
          <Maximize2 className="h-5 w-5" />
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          className="gap-1.5 rounded-full px-4"
        >
          <Send className="h-4 w-4" />
          Nashr
        </Button>
      </div>
    </div>
  );
};
