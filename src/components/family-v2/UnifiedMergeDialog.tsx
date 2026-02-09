import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Link, GitMerge, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MergeDialogData } from '@/hooks/useFamilyInvitations';
import { ChildProfile, ChildMergeSuggestion } from '@/hooks/useTreeMerging';

interface ChildMergeItem {
  sourceChild: ChildProfile;
  targetChild: ChildProfile | null;
  shouldMerge: boolean;
}

interface UnifiedMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: MergeDialogData;
  onConfirm: (childMerges: { sourceId: string; targetId: string }[]) => void;
  isProcessing: boolean;
}

export const UnifiedMergeDialog = ({
  isOpen,
  onClose,
  data,
  onConfirm,
  isProcessing,
}: UnifiedMergeDialogProps) => {
  // Farzandlar birlashish holatini boshqarish
  const [childItems, setChildItems] = useState<ChildMergeItem[]>(() => {
    const items: ChildMergeItem[] = [];
    const usedTargetIds = new Set<string>();
    
    // Avval tavsiya etilganlarni qo'shish (avtomatik tanlangan)
    for (const suggestion of data.childSuggestions) {
      items.push({
        sourceChild: suggestion.sourceChild,
        targetChild: suggestion.targetChild,
        shouldMerge: true, // Tavsiya etilganlar avtomatik tanlangan
      });
      usedTargetIds.add(suggestion.targetChild.id);
    }
    
    // Tavsiya etilmagan source farzandlarni qo'shish
    for (const source of data.allSourceChildren) {
      if (items.find(i => i.sourceChild.id === source.id)) continue;
      
      // Bir xil jinsdagi bo'sh target ni topish
      const availableTarget = data.allTargetChildren.find(
        t => t.gender === source.gender && !usedTargetIds.has(t.id)
      );
      
      if (availableTarget) {
        items.push({
          sourceChild: source,
          targetChild: availableTarget,
          shouldMerge: false,
        });
        usedTargetIds.add(availableTarget.id);
      } else {
        items.push({
          sourceChild: source,
          targetChild: null,
          shouldMerge: false,
        });
      }
    }
    
    return items;
  });
  
  // Toggle merge status
  const toggleMerge = (index: number) => {
    setChildItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (!item.targetChild) return item;
      if (item.sourceChild.gender !== item.targetChild.gender) return item;
      return { ...item, shouldMerge: !item.shouldMerge };
    }));
  };
  
  // Confirm button handler
  const handleConfirm = () => {
    const childMerges = childItems
      .filter(item => item.shouldMerge && item.targetChild)
      .map(item => ({
        sourceId: item.sourceChild.id,
        targetId: item.targetChild!.id,
      }));
    
    onConfirm(childMerges);
  };
  
  // Stats
  const stats = useMemo(() => ({
    parents: data.parentMerges.length,
    childrenMerge: childItems.filter(i => i.shouldMerge && i.targetChild).length,
    childrenSeparate: childItems.filter(i => !i.shouldMerge || !i.targetChild).length,
  }), [data.parentMerges.length, childItems]);
  
  const hasChildren = data.allSourceChildren.length > 0 || data.allTargetChildren.length > 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Daraxtlarni birlashtirish
          </DialogTitle>
          <DialogDescription>
            {data.senderName} bilan {data.receiverName} ning oila daraxtlari birlashtirilmoqda
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Ota-onalar (avtomatik) */}
          {data.parentMerges.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Link className="h-4 w-4 text-emerald-500" />
                Avtomatik birlashadi ({data.parentMerges.length})
              </h3>
              <div className="space-y-1.5">
                {data.parentMerges.map((merge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
                  >
                    <ProfileBadge
                      name={merge.sourceName}
                      photoUrl={merge.sourcePhotoUrl}
                      gender="male"
                    />
                    <span className="text-xs text-emerald-600">=</span>
                    <ProfileBadge
                      name={merge.targetName}
                      photoUrl={merge.targetPhotoUrl}
                      gender="male"
                    />
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {merge.relationship === 'parent' ? 'Ota-ona' : 'Buvi-bobo'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Farzandlar (foydalanuvchi tanlov qiladi) */}
          {hasChildren && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Farzandlarni birlashtirish</h3>
              <p className="text-xs text-muted-foreground">
                ✓ belgilanganlari birlashadi, ✗ belgilanmagan alohida qoladi
              </p>
              
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-2">
                  {childItems.map((item, idx) => (
                    <ChildMergeRow
                      key={idx}
                      item={item}
                      onToggle={() => toggleMerge(idx)}
                    />
                  ))}
                  {childItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Birlashtiriladigan farzandlar yo'q
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          
          {/* Summary */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground bg-muted/30 py-2 rounded-lg">
            {stats.parents > 0 && (
              <span className="flex items-center gap-1">
                <Link className="w-3.5 h-3.5 text-emerald-500" />
                Ota-ona: <strong className="text-foreground">{stats.parents}</strong>
              </span>
            )}
            {hasChildren && (
              <>
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <strong className="text-foreground">{stats.childrenMerge}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  <strong className="text-foreground">{stats.childrenSeparate}</strong>
                </span>
              </>
            )}
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
              onClick={handleConfirm}
              className="flex-1"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saqlanmoqda...
                </>
              ) : (
                'Tasdiqlash'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Profile badge component
const ProfileBadge = ({ 
  name, 
  photoUrl, 
  gender 
}: { 
  name: string; 
  photoUrl?: string; 
  gender: string;
}) => (
  <div className="flex items-center gap-1.5">
    <div className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white",
      gender === 'male' ? "bg-sky-500" : "bg-pink-500"
    )}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        name?.[0]?.toUpperCase() || '?'
      )}
    </div>
    <span className="text-xs font-medium truncate max-w-[80px]">{name}</span>
  </div>
);

// Child merge row component
const ChildMergeRow = ({
  item,
  onToggle,
}: {
  item: ChildMergeItem;
  onToggle: () => void;
}) => {
  const { sourceChild, targetChild, shouldMerge } = item;
  const canMerge = targetChild && targetChild.gender === sourceChild.gender;
  const isMale = sourceChild.gender === 'male';
  
  return (
    <div className={cn(
      "flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all",
      shouldMerge && canMerge ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card border-muted"
    )}>
      {/* Source Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
        isMale ? "bg-sky-500" : "bg-pink-500"
      )}>
        {sourceChild.photoUrl ? (
          <img src={sourceChild.photoUrl} alt={sourceChild.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          sourceChild.name?.[0]?.toUpperCase() || '?'
        )}
      </div>
      
      {/* Source Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{sourceChild.name}</p>
        <p className="text-[10px] text-muted-foreground">Yangi</p>
      </div>
      
      {/* Connection */}
      {targetChild ? (
        <div className="flex items-center gap-1 px-1">
          <div className={cn(
            "w-4 h-0.5 rounded",
            shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
          )} />
          <span className={cn(
            "text-xs",
            shouldMerge ? "text-emerald-600" : "text-muted-foreground"
          )}>
            {shouldMerge ? '=' : '≠'}
          </span>
          <div className={cn(
            "w-4 h-0.5 rounded",
            shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
          )} />
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground px-2">Alohida</span>
      )}
      
      {/* Target Avatar */}
      {targetChild && (
        <>
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
            isMale ? "bg-sky-500" : "bg-pink-500"
          )}>
            {targetChild.photoUrl ? (
              <img src={targetChild.photoUrl} alt={targetChild.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              targetChild.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{targetChild.name}</p>
            <p className="text-[10px] text-muted-foreground">Mavjud</p>
          </div>
        </>
      )}
      
      {/* Toggle */}
      {canMerge && (
        <button
          onClick={onToggle}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 flex-shrink-0",
            shouldMerge
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600"
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
          )}
        >
          {shouldMerge ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : (
            <X className="w-4 h-4" strokeWidth={2.5} />
          )}
        </button>
      )}
    </div>
  );
};
