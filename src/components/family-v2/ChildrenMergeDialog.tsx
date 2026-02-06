import { useState, useCallback } from 'react';
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

interface ChildMergeItem {
  child: ChildProfile;
  shouldMerge: boolean; // true = merge, false = keep separate
  pairedWithId?: string; // ID of child from other side to merge with
}

interface ChildrenMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  parentDescription: string;
  onComplete: (merges: { sourceId: string; targetId: string }[], separates: string[]) => Promise<void>;
}

export const ChildrenMergeDialog = ({
  isOpen,
  onClose,
  sourceChildren,
  targetChildren,
  parentDescription,
  onComplete,
}: ChildrenMergeDialogProps) => {
  // Initialize items with merge state
  const [sourceItems, setSourceItems] = useState<ChildMergeItem[]>(() =>
    sourceChildren.map(child => ({ child, shouldMerge: true }))
  );
  
  const [targetItems, setTargetItems] = useState<ChildMergeItem[]>(() =>
    targetChildren.map(child => ({ child, shouldMerge: true }))
  );
  
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Drag state for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragSide, setDragSide] = useState<'source' | 'target' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Toggle merge/separate for an item
  const toggleMerge = useCallback((side: 'source' | 'target', id: string) => {
    if (side === 'source') {
      setSourceItems(prev => prev.map(item => 
        item.child.id === id 
          ? { ...item, shouldMerge: !item.shouldMerge, pairedWithId: undefined }
          : item
      ));
      // Also clear any pairing from target side
      setTargetItems(prev => prev.map(item =>
        item.pairedWithId === id ? { ...item, pairedWithId: undefined } : item
      ));
    } else {
      setTargetItems(prev => prev.map(item => 
        item.child.id === id 
          ? { ...item, shouldMerge: !item.shouldMerge, pairedWithId: undefined }
          : item
      ));
      // Also clear any pairing from source side
      setSourceItems(prev => prev.map(item =>
        item.pairedWithId === id ? { ...item, pairedWithId: undefined } : item
      ));
    }
  }, []);

  // Handle pairing - when user selects source then clicks target
  const handleSelectForPairing = useCallback((side: 'source' | 'target', id: string) => {
    const item = side === 'source' 
      ? sourceItems.find(i => i.child.id === id)
      : targetItems.find(i => i.child.id === id);
    
    if (!item?.shouldMerge) return; // Don't pair items marked as separate
    
    if (side === 'source') {
      if (selectedSourceId === id) {
        setSelectedSourceId(null);
      } else {
        setSelectedSourceId(id);
      }
    } else if (selectedSourceId) {
      // Pair source with this target
      const sourceItem = sourceItems.find(i => i.child.id === selectedSourceId);
      const targetItem = targetItems.find(i => i.child.id === id);
      
      if (sourceItem?.shouldMerge && targetItem?.shouldMerge) {
        // Check gender match
        if (sourceItem.child.gender !== targetItem.child.gender) {
          return; // Can't pair different genders
        }
        
        // Clear any existing pairings
        setSourceItems(prev => prev.map(item => 
          item.child.id === selectedSourceId 
            ? { ...item, pairedWithId: id }
            : item.pairedWithId === id ? { ...item, pairedWithId: undefined } : item
        ));
        setTargetItems(prev => prev.map(item => 
          item.child.id === id 
            ? { ...item, pairedWithId: selectedSourceId }
            : item.pairedWithId === selectedSourceId ? { ...item, pairedWithId: undefined } : item
        ));
      }
      setSelectedSourceId(null);
    }
  }, [selectedSourceId, sourceItems, targetItems]);

  // Drag handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number, side: 'source' | 'target') => {
    setDraggedIndex(index);
    setDragSide(side);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number, side: 'source' | 'target') => {
    e.preventDefault();
    if (dragSide === side) {
      setDragOverIndex(index);
    }
  }, [dragSide]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number, side: 'source' | 'target') => {
    e.preventDefault();
    
    if (draggedIndex === null || dragSide !== side || draggedIndex === dropIndex) {
      resetDrag();
      return;
    }

    const setter = side === 'source' ? setSourceItems : setTargetItems;
    setter(prev => {
      const newItems = [...prev];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(dropIndex, 0, removed);
      return newItems;
    });
    
    resetDrag();
  }, [draggedIndex, dragSide]);

  const resetDrag = () => {
    setDraggedIndex(null);
    setDragSide(null);
    setDragOverIndex(null);
  };

  // Complete the merge
  const handleComplete = async () => {
    setIsProcessing(true);
    
    try {
      // Collect merges (paired items)
      const merges: { sourceId: string; targetId: string }[] = [];
      sourceItems.forEach(item => {
        if (item.shouldMerge && item.pairedWithId) {
          merges.push({
            sourceId: item.child.id,
            targetId: item.pairedWithId,
          });
        }
      });
      
      // Collect separates (items marked with X that should be added as separate children)
      const separates: string[] = [
        ...sourceItems.filter(i => !i.shouldMerge).map(i => i.child.id),
        ...targetItems.filter(i => !i.shouldMerge).map(i => i.child.id),
      ];
      
      await onComplete(merges, separates);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const renderChildItem = (
    item: ChildMergeItem, 
    index: number, 
    side: 'source' | 'target'
  ) => {
    const { child, shouldMerge, pairedWithId } = item;
    const isMale = child.gender === 'male';
    const isSelected = side === 'source' && selectedSourceId === child.id;
    const isPaired = !!pairedWithId;
    const isDragging = draggedIndex === index && dragSide === side;
    const isDropTarget = dragOverIndex === index && dragSide === side;
    
    return (
      <div
        key={child.id}
        draggable
        onDragStart={(e) => handleDragStart(e, index, side)}
        onDragOver={(e) => handleDragOver(e, index, side)}
        onDragLeave={resetDrag}
        onDrop={(e) => handleDrop(e, index, side)}
        onDragEnd={resetDrag}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg border-2 transition-all duration-200",
          "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50 scale-95",
          isDropTarget && !isDragging && "border-primary border-dashed",
          isPaired && "bg-primary/10 border-primary/50",
          isSelected && "ring-2 ring-primary",
          !shouldMerge && "opacity-60 bg-muted/30 border-muted"
        )}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        
        {/* Avatar */}
        <div 
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
            isMale ? "bg-sky-500" : "bg-pink-500"
          )}
          onClick={() => handleSelectForPairing(side, child.id)}
        >
          {child.photoUrl ? (
            <img 
              src={child.photoUrl} 
              alt={child.name}
              className="w-full h-full rounded-full object-cover cursor-pointer"
            />
          ) : (
            <span className="text-sm font-bold text-white cursor-pointer">
              {child.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        
        {/* Name */}
        <div 
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => handleSelectForPairing(side, child.id)}
        >
          <p className="text-sm font-medium truncate">{child.name}</p>
          {isPaired && (
            <p className="text-[10px] text-primary">Birlashtiriladi</p>
          )}
        </div>
        
        {/* Toggle button */}
        <button
          onClick={() => toggleMerge(side, child.id)}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
            shouldMerge 
              ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" 
              : "bg-destructive/20 text-destructive hover:bg-destructive/30"
          )}
        >
          {shouldMerge ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  };

  const pairedCount = sourceItems.filter(i => i.pairedWithId).length;
  const separateCount = sourceItems.filter(i => !i.shouldMerge).length + 
                        targetItems.filter(i => !i.shouldMerge).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Farzandlarni birlashtirish
          </DialogTitle>
          <DialogDescription>
            {parentDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
            <p>• Farzandlarni yuqoriga-pastga sudrab tartibini o'zgartiring</p>
            <p>• <Check className="w-3 h-3 inline text-green-500" /> - birlashtiriladi, <X className="w-3 h-3 inline text-destructive" /> - alohida qoladi</p>
            <p>• Birlash uchun: chap tomondan tanlang, keyin o'ng tomondan bosing</p>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Source children */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-center py-1 bg-muted/50 rounded">
                Yangi daraxtdan
              </h4>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-2">
                  {sourceItems.map((item, idx) => renderChildItem(item, idx, 'source'))}
                </div>
              </ScrollArea>
            </div>

            {/* Target children */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-center py-1 bg-muted/50 rounded">
                Sizning daraxtingiz
              </h4>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-2">
                  {targetItems.map((item, idx) => renderChildItem(item, idx, 'target'))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg">
            <span>Birlashtiriladi: {pairedCount}</span>
            <span>Alohida qoladi: {separateCount}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
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
