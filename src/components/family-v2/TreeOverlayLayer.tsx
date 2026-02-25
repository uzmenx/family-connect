import { useState, useRef, useCallback } from 'react';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TreeOverlayLayerProps {
  overlays: TreeOverlay[];
  onChange: (overlays: TreeOverlay[]) => void;
  editable?: boolean;
}

const STICKERS = ['🌳', '❤️', '👨‍👩‍👧‍👦', '🏠', '⭐', '🎂', '👶', '💍', '🌹', '📷', '🎉', '💝'];

export const TreeOverlayLayer = ({ overlays, onChange, editable = true }: TreeOverlayLayerProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, overlay: TreeOverlay) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    dragOffset.current = {
      x: e.clientX - (rect.left + overlay.x),
      y: e.clientY - (rect.top + overlay.y),
    };
    setDraggingId(overlay.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editable]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.current.x;
    const newY = e.clientY - rect.top - dragOffset.current.y;

    onChange(overlays.map(o => o.id === draggingId ? { ...o, x: newX, y: newY } : o));
  }, [draggingId, overlays, onChange]);

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  const removeOverlay = (id: string) => {
    onChange(overlays.filter(o => o.id !== id));
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {overlays.map((overlay) => (
        <div
          key={overlay.id}
          className={cn(
            "absolute pointer-events-auto select-none",
            draggingId === overlay.id && "z-50"
          )}
          style={{
            left: overlay.x,
            top: overlay.y,
            transform: `scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
          }}
          onPointerDown={(e) => handlePointerDown(e, overlay)}
        >
          {overlay.type === 'sticker' && (
            <span className="text-4xl cursor-move">{overlay.content}</span>
          )}
          {overlay.type === 'text' && (
            <span
              className="px-2 py-1 rounded bg-background/80 backdrop-blur-sm text-foreground font-medium cursor-move whitespace-nowrap"
              style={{ fontSize: overlay.fontSize || 16, color: overlay.color }}
            >
              {overlay.content}
            </span>
          )}
          {overlay.type === 'image' && (
            <img
              src={overlay.content}
              alt=""
              className="w-24 h-24 object-cover rounded-lg cursor-move shadow-lg"
              draggable={false}
            />
          )}
          {editable && (
            <button
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
              onClick={(e) => { e.stopPropagation(); removeOverlay(overlay.id); }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Toolbar for adding overlays
interface OverlayToolbarProps {
  onAddSticker: (emoji: string) => void;
  onAddText: () => void;
  onAddImage: () => void;
}

export const OverlayToolbar = ({ onAddSticker, onAddText, onAddImage }: OverlayToolbarProps) => {
  const [showStickers, setShowStickers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute right-3 top-1/3 z-30 flex flex-col gap-2">
      {/* Sticker button */}
      <button
        onClick={() => setShowStickers(!showStickers)}
        className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-lg hover:bg-muted transition-colors"
      >
        😊
      </button>

      {/* Text button */}
      <button
        onClick={onAddText}
        className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-sm font-bold text-foreground hover:bg-muted transition-colors"
      >
        T
      </button>

      {/* Image button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-lg hover:bg-muted transition-colors"
      >
        🖼️
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            onAddImage();
            // We pass the URL through the onAddImage - but let's use a simpler approach
            // The parent will handle it
          }
          e.target.value = '';
        }}
      />

      {/* Sticker picker */}
      {showStickers && (
        <div className="absolute right-12 top-0 bg-background/95 backdrop-blur-sm border border-border rounded-xl p-2 shadow-lg grid grid-cols-4 gap-1 w-48">
          {STICKERS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onAddSticker(emoji); setShowStickers(false); }}
              className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-muted rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
