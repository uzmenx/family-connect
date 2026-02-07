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
import { Check, X, GripVertical, Users } from 'lucide-react';
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
  sourceChild: ChildProfile;
  targetChild: ChildProfile | null;
  shouldMerge: boolean;
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
  // Build paired items from suggestions and unpaired children
  const [items, setItems] = useState<ChildMergeItem[]>(() => {
    const result: ChildMergeItem[] = [];
    const usedSourceIds = new Set<string>();
    const usedTargetIds = new Set<string>();

    // First: add suggested pairs (auto-accepted)
    for (const pair of suggestedPairs) {
      result.push({
        sourceChild: pair.sourceChild,
        targetChild: pair.targetChild,
        shouldMerge: true, // Auto-accept suggestions
      });
      usedSourceIds.add(pair.sourceChild.id);
      usedTargetIds.add(pair.targetChild.id);
    }

    // Second: add unpaired source children
    for (const source of sourceChildren) {
      if (!usedSourceIds.has(source.id)) {
        // Try to find a matching target by gender
        const availableTarget = targetChildren.find(
          t => t.gender === source.gender && !usedTargetIds.has(t.id)
        );
        
        if (availableTarget) {
          result.push({
            sourceChild: source,
            targetChild: availableTarget,
            shouldMerge: false, // Not auto-accepted (no name similarity)
          });
          usedTargetIds.add(availableTarget.id);
        } else {
          // No matching target - will be kept separate
          result.push({
            sourceChild: source,
            targetChild: null,
            shouldMerge: false,
          });
        }
        usedSourceIds.add(source.id);
      }
    }

    // Third: add unpaired target children (as separate)
    for (const target of targetChildren) {
      if (!usedTargetIds.has(target.id)) {
        // These will just stay in target tree
        // We don't need to add them to the list since they're already there
      }
    }

    return result;
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Toggle merge status for an item
  const toggleMerge = useCallback((index: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      // Can only merge if there's a matching target with same gender
      if (!item.targetChild || item.sourceChild.gender !== item.targetChild.gender) {
        return item;
      }
      return { ...item, shouldMerge: !item.shouldMerge };
    }));
  }, []);

  // Swap target children between two rows (drag & drop)
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      const draggedItem = items[draggedIndex];
      const overItem = items[index];
      
      // Only allow swap if both have targets and same gender
      if (draggedItem?.targetChild && overItem?.targetChild &&
          draggedItem.sourceChild.gender === overItem.sourceChild.gender) {
        setDragOverIndex(index);
      }
    }
  }, [draggedIndex, items]);

  const handleDrop = useCallback((dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      resetDrag();
      return;
    }

    const draggedItem = items[draggedIndex];
    const dropItem = items[dropIndex];

    // Only allow swap if same gender
    if (draggedItem.sourceChild.gender !== dropItem.sourceChild.gender) {
      resetDrag();
      return;
    }

    // Swap targets
    setItems(prev => {
      const newItems = [...prev];
      const tempTarget = newItems[draggedIndex].targetChild;
      newItems[draggedIndex] = {
        ...newItems[draggedIndex],
        targetChild: newItems[dropIndex].targetChild,
        shouldMerge: false, // Reset merge status after swap
      };
      newItems[dropIndex] = {
        ...newItems[dropIndex],
        targetChild: tempTarget,
        shouldMerge: false,
      };
      return newItems;
    });

    resetDrag();
  }, [draggedIndex, items]);

  const resetDrag = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Complete merge
  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      const merges: { sourceId: string; targetId: string }[] = [];
      const separateIds: string[] = [];

      items.forEach(item => {
        if (item.shouldMerge && item.targetChild) {
          merges.push({
            sourceId: item.sourceChild.id,
            targetId: item.targetChild.id,
          });
        } else {
          separateIds.push(item.sourceChild.id);
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
    const merged = items.filter(i => i.shouldMerge && i.targetChild).length;
    const separate = items.filter(i => !i.shouldMerge || !i.targetChild).length;
    return { merged, separate };
  }, [items]);

  const renderPairRow = (item: ChildMergeItem, index: number) => {
    const { sourceChild, targetChild, shouldMerge } = item;
    const isMale = sourceChild.gender === 'male';
    const isDragging = draggedIndex === index;
    const isDropTarget = dragOverIndex === index;
    const canMerge = targetChild && targetChild.gender === sourceChild.gender;

    return (
      <div
        key={`${sourceChild.id}-${index}`}
        draggable={!!targetChild}
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={() => setDragOverIndex(null)}
        onDrop={() => handleDrop(index)}
        onDragEnd={resetDrag}
        className={cn(
          "flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200",
          "bg-card",
          isDragging && "opacity-50 scale-95",
          isDropTarget && !isDragging && "border-primary border-dashed bg-primary/5",
          shouldMerge && canMerge && "bg-emerald-500/5 border-emerald-500/30",
          !shouldMerge && "border-muted"
        )}
      >
        {/* Drag Handle */}
        {targetChild && (
          <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        )}
        
        {/* Source Child Avatar */}
        <div
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ring-2",
            isMale ? "bg-sky-500/90 ring-sky-400/50" : "bg-pink-500/90 ring-pink-400/50"
          )}
        >
          {sourceChild.photoUrl ? (
            <img
              src={sourceChild.photoUrl}
              alt={sourceChild.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-white">
              {sourceChild.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Source Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{sourceChild.name}</p>
          <p className="text-[10px] text-muted-foreground">
            Yangi daraxtdan
          </p>
        </div>

        {/* Arrow / Connection */}
        {targetChild ? (
          <div className="flex items-center gap-1 px-2">
            <div className={cn(
              "w-6 h-0.5 rounded",
              shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
            )} />
            <span className={cn(
              "text-xs",
              shouldMerge ? "text-emerald-600" : "text-muted-foreground"
            )}>
              {shouldMerge ? '=' : '≠'}
            </span>
            <div className={cn(
              "w-6 h-0.5 rounded",
              shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
            )} />
          </div>
        ) : (
          <div className="px-4 text-xs text-muted-foreground">
            Alohida qoladi
          </div>
        )}

        {/* Target Child Avatar */}
        {targetChild && (
          <>
            <div
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ring-2",
                isMale ? "bg-sky-500/90 ring-sky-400/50" : "bg-pink-500/90 ring-pink-400/50"
              )}
            >
              {targetChild.photoUrl ? (
                <img
                  src={targetChild.photoUrl}
                  alt={targetChild.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">
                  {targetChild.name?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* Target Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{targetChild.name}</p>
              <p className="text-[10px] text-muted-foreground">
                Sizning daraxt
              </p>
            </div>
          </>
        )}

        {/* Toggle button */}
        {canMerge && (
          <button
            onClick={() => toggleMerge(index)}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              "border-2 flex-shrink-0",
              shouldMerge
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/30"
                : "bg-muted/50 border-muted-foreground/20 text-muted-foreground hover:bg-muted"
            )}
          >
            {shouldMerge ? (
              <Check className="w-5 h-5" strokeWidth={3} />
            ) : (
              <X className="w-5 h-5" strokeWidth={2.5} />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh]">
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
          <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg space-y-1.5">
            <p className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> 
              <span>Belgilanganlari birlashadi - bir kishi sifatida ko'rinadi</span>
            </p>
            <p className="flex items-center gap-2">
              <X className="w-4 h-4 text-muted-foreground flex-shrink-0" /> 
              <span>Belgilanmaganlari alohida qoladi - yangi farzand sifatida qo'shiladi</span>
            </p>
            <p className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" /> 
              <span>Sudrab joyini almashtiring (bir xil jins)</span>
            </p>
          </div>

          {/* List */}
          <ScrollArea className="h-[320px]">
            <div className="space-y-2 pr-2">
              {items.map((item, idx) => renderPairRow(item, idx))}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Birlashtiriladigan farzandlar yo'q
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Summary */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground bg-muted/30 py-2.5 rounded-lg">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Birlashadi: <strong className="text-foreground">{stats.merged}</strong></span>
            </span>
            <span className="flex items-center gap-2">
              <X className="w-4 h-4" />
              <span>Alohida: <strong className="text-foreground">{stats.separate}</strong></span>
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
