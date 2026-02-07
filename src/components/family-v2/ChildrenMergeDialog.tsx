import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, GripVertical, Users, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

interface SuggestedPair {
  sourceChild: ChildProfile;
  targetChild: ChildProfile;
  similarity: number;
}

interface ChildMergeItem {
  child: ChildProfile;
  pairedWithId?: string;
  shouldMerge: boolean; // true = merge with pair, false = keep separate
}

interface ChildrenMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  suggestedPairs: SuggestedPair[];
  parentDescription: string;
  onComplete: (
    merges: { sourceId: string; targetId: string }[],
    separateIds: string[]
  ) => Promise<void>;
}

export const ChildrenMergeDialog = ({
  isOpen,
  onClose,
  sourceChildren,
  targetChildren,
  suggestedPairs,
  parentDescription,
  onComplete,
}: ChildrenMergeDialogProps) => {
  // Initialize with suggested pairs (default: accept all suggestions)
  const [sourceItems, setSourceItems] = useState<ChildMergeItem[]>(() => {
    return sourceChildren.map(child => {
      const pair = suggestedPairs.find(p => p.sourceChild.id === child.id);
      return {
        child,
        pairedWithId: pair?.targetChild.id,
        shouldMerge: !!pair, // Auto-accept if there's a suggestion
      };
    });
  });

  const [targetItems, setTargetItems] = useState<ChildMergeItem[]>(() => {
    return targetChildren.map(child => {
      const pair = suggestedPairs.find(p => p.targetChild.id === child.id);
      return {
        child,
        pairedWithId: pair?.sourceChild.id,
        shouldMerge: !!pair,
      };
    });
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragSide, setDragSide] = useState<'source' | 'target' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Toggle merge status for an item
  const toggleMerge = useCallback((side: 'source' | 'target', id: string) => {
    if (side === 'source') {
      setSourceItems(prev => prev.map(item => {
        if (item.child.id !== id) return item;
        const newShouldMerge = !item.shouldMerge;
        // If turning off, also unpair
        if (!newShouldMerge) {
          // Also update target side
          setTargetItems(t => t.map(ti => 
            ti.pairedWithId === id ? { ...ti, pairedWithId: undefined, shouldMerge: false } : ti
          ));
          return { ...item, shouldMerge: false, pairedWithId: undefined };
        }
        return { ...item, shouldMerge: true };
      }));
    } else {
      setTargetItems(prev => prev.map(item => {
        if (item.child.id !== id) return item;
        const newShouldMerge = !item.shouldMerge;
        if (!newShouldMerge) {
          setSourceItems(s => s.map(si =>
            si.pairedWithId === id ? { ...si, pairedWithId: undefined, shouldMerge: false } : si
          ));
          return { ...item, shouldMerge: false, pairedWithId: undefined };
        }
        return { ...item, shouldMerge: true };
      }));
    }
  }, []);

  // Swap positions (drag & drop within same side)
  const handleDragStart = useCallback((index: number, side: 'source' | 'target') => {
    setDraggedIndex(index);
    setDragSide(side);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number, side: 'source' | 'target') => {
    e.preventDefault();
    if (dragSide === side && draggedIndex !== null) {
      setDragOverIndex(index);
    }
  }, [dragSide, draggedIndex]);

  const handleDrop = useCallback((dropIndex: number, side: 'source' | 'target') => {
    if (draggedIndex === null || dragSide !== side || draggedIndex === dropIndex) {
      resetDrag();
      return;
    }

    const setter = side === 'source' ? setSourceItems : setTargetItems;
    setter(prev => {
      const items = [...prev];
      const draggedItem = items[draggedIndex];
      const dropItem = items[dropIndex];
      
      // Only allow swap if same gender
      if (draggedItem.child.gender !== dropItem.child.gender) {
        return prev;
      }

      // Swap positions
      [items[draggedIndex], items[dropIndex]] = [items[dropIndex], items[draggedIndex]];
      return items;
    });

    resetDrag();
  }, [draggedIndex, dragSide]);

  const resetDrag = () => {
    setDraggedIndex(null);
    setDragSide(null);
    setDragOverIndex(null);
  };

  // Complete merge
  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      // Collect confirmed merges
      const merges: { sourceId: string; targetId: string }[] = [];
      const separateIds: string[] = [];

      sourceItems.forEach((item, idx) => {
        const targetItem = targetItems[idx];
        
        if (item.shouldMerge && targetItem?.shouldMerge) {
          // Same position + both marked = merge
          if (item.child.gender === targetItem.child.gender) {
            merges.push({
              sourceId: item.child.id,
              targetId: targetItem.child.id,
            });
          }
        } else {
          // Not merging = keep separate
          if (!item.shouldMerge) separateIds.push(item.child.id);
        }
      });

      // Also add remaining target items that aren't merged
      targetItems.forEach((item, idx) => {
        if (!item.shouldMerge && !separateIds.includes(item.child.id)) {
          separateIds.push(item.child.id);
        }
      });

      await onComplete(merges, separateIds);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const paired = sourceItems.filter((s, i) => 
      s.shouldMerge && targetItems[i]?.shouldMerge && 
      s.child.gender === targetItems[i]?.child.gender
    ).length;
    
    const separate = sourceItems.filter(s => !s.shouldMerge).length +
                     targetItems.filter(t => !t.shouldMerge).length;
    
    return { paired, separate };
  }, [sourceItems, targetItems]);

  const renderChildItem = (
    item: ChildMergeItem,
    index: number,
    side: 'source' | 'target'
  ) => {
    const { child, shouldMerge } = item;
    const isMale = child.gender === 'male';
    const isDragging = draggedIndex === index && dragSide === side;
    const isDropTarget = dragOverIndex === index && dragSide === side;

    // Check if opposite side at same index has same gender
    const oppositeItems = side === 'source' ? targetItems : sourceItems;
    const oppositeItem = oppositeItems[index];
    const canMerge = oppositeItem && oppositeItem.child.gender === child.gender;

    return (
      <div
        key={child.id}
        draggable
        onDragStart={() => handleDragStart(index, side)}
        onDragOver={(e) => handleDragOver(e, index, side)}
        onDragLeave={resetDrag}
        onDrop={() => handleDrop(index, side)}
        onDragEnd={resetDrag}
        className={cn(
          "flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200",
          "cursor-grab active:cursor-grabbing bg-card",
          isDragging && "opacity-50 scale-95",
          isDropTarget && !isDragging && "border-primary border-dashed",
          shouldMerge && canMerge && "bg-primary/5 border-primary/30",
          !shouldMerge && "opacity-60 border-muted"
        )}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
        
        {/* Avatar */}
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-2",
            isMale ? "bg-sky-500/90 ring-sky-400/50" : "bg-pink-500/90 ring-pink-400/50"
          )}
        >
          {child.photoUrl ? (
            <img
              src={child.photoUrl}
              alt={child.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-white">
              {child.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{child.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {isMale ? 'O\'g\'il' : 'Qiz'}
          </p>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => toggleMerge(side, child.id)}
          disabled={!canMerge && shouldMerge}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center transition-all",
            "border-2",
            shouldMerge
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/30"
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted",
            !canMerge && "opacity-50 cursor-not-allowed"
          )}
        >
          {shouldMerge ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : (
            <X className="w-4 h-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Farzandlarni birlashtirish
          </DialogTitle>
          <DialogDescription>
            {parentDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Instructions */}
          <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg space-y-1">
            <p className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-500" /> = birlashadi
              <span className="mx-1">•</span>
              <X className="w-3 h-3" /> = alohida qoladi
            </p>
            <p className="flex items-center gap-1.5">
              <GripVertical className="w-3 h-3" /> sudrab joyini almashtiring
              <span className="mx-1">•</span>
              <ArrowLeftRight className="w-3 h-3" /> bir xil jins
            </p>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-3">
            {/* Source children */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-center py-1.5 bg-muted/60 rounded-lg">
                Yangi daraxtdan
              </h4>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-1">
                  {sourceItems.map((item, idx) => renderChildItem(item, idx, 'source'))}
                  {sourceItems.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Farzandlar yo'q
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Target children */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-center py-1.5 bg-muted/60 rounded-lg">
                Sizning daraxtingiz
              </h4>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-1">
                  {targetItems.map((item, idx) => renderChildItem(item, idx, 'target'))}
                  {targetItems.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Farzandlar yo'q
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground bg-muted/30 py-2 rounded-lg">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Birlashadi: {stats.paired}
            </span>
            <span className="flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" />
              Alohida: {stats.separate}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isProcessing}
            >
              Bekor qilish
            </Button>
            <Button
              onClick={handleComplete}
              className="flex-1"
              disabled={isProcessing}
            >
              {isProcessing ? 'Saqlanmoqda...' : 'Tasdiqlash'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
