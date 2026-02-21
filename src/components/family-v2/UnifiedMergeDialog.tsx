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
import { Check, X, Link, GitMerge, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MergeDialogData } from '@/hooks/useFamilyInvitations';
import { ChildProfile, ChildMergeSuggestion, CoupleGroup } from '@/hooks/useTreeMerging';

interface ChildMergeItem {
  sourceChild: ChildProfile;
  targetChild: ChildProfile | null;
  shouldMerge: boolean;
  /** Birlashish balli (tavsiya qatorlari uchun) */
  similarity?: number;
}

interface UnifiedMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: MergeDialogData;
  onConfirm: (childMerges: { sourceId: string; targetId: string }[]) => void;
  isProcessing: boolean;
}

const AUTO_MERGE_THRESHOLD = 90;

/**
 * Build child merge items for a couple group
 */
const buildChildItems = (group: CoupleGroup): ChildMergeItem[] => {
  const items: ChildMergeItem[] = [];
  const usedTargetIds = new Set<string>();
  
  for (const suggestion of group.childSuggestions) {
    items.push({
      sourceChild: suggestion.sourceChild,
      targetChild: suggestion.targetChild,
      shouldMerge: suggestion.similarity >= AUTO_MERGE_THRESHOLD,
      similarity: suggestion.similarity,
    });
    usedTargetIds.add(suggestion.targetChild.id);
  }

  for (const source of group.sourceChildren) {
    if (items.find(i => i.sourceChild.id === source.id)) continue;

    const availableTarget = group.targetChildren.find(
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
};

/**
 * Build child items from flat data (backward compat when no coupleGroups)
 */
const buildFlatChildItems = (data: MergeDialogData): ChildMergeItem[] => {
  const items: ChildMergeItem[] = [];
  const usedTargetIds = new Set<string>();
  
  for (const suggestion of data.childSuggestions) {
    items.push({
      sourceChild: suggestion.sourceChild,
      targetChild: suggestion.targetChild,
      shouldMerge: suggestion.similarity >= AUTO_MERGE_THRESHOLD,
      similarity: suggestion.similarity,
    });
    usedTargetIds.add(suggestion.targetChild.id);
  }
  
  for (const source of data.allSourceChildren) {
    if (items.find(i => i.sourceChild.id === source.id)) continue;
    const availableTarget = data.allTargetChildren.find(
      t => t.gender === source.gender && !usedTargetIds.has(t.id)
    );
    if (availableTarget) {
      items.push({ sourceChild: source, targetChild: availableTarget, shouldMerge: false });
      usedTargetIds.add(availableTarget.id);
    } else {
      items.push({ sourceChild: source, targetChild: null, shouldMerge: false });
    }
  }
  
  return items;
};

export const UnifiedMergeDialog = ({
  isOpen,
  onClose,
  data,
  onConfirm,
  isProcessing,
}: UnifiedMergeDialogProps) => {
  const hasCoupleGroups = data.coupleGroups.length > 0;
  
  // State: grouped child items (2D array, one per couple group)
  const [groupedChildItems, setGroupedChildItems] = useState<ChildMergeItem[][]>(() => {
    if (hasCoupleGroups) {
      return data.coupleGroups.map(buildChildItems);
    }
    // Backward compat: single flat group
    const flatItems = buildFlatChildItems(data);
    return flatItems.length > 0 ? [flatItems] : [];
  });
  
  // Toggle merge status for a specific group and index
  const toggleMerge = (groupIdx: number, itemIdx: number) => {
    setGroupedChildItems(prev => prev.map((group, gi) => {
      if (gi !== groupIdx) return group;
      return group.map((item, ii) => {
        if (ii !== itemIdx) return item;
        if (!item.targetChild) return item;
        if (item.sourceChild.gender !== item.targetChild.gender) return item;
        return { ...item, shouldMerge: !item.shouldMerge };
      });
    }));
  };
  
  // Confirm handler
  const handleConfirm = () => {
    const childMerges: { sourceId: string; targetId: string }[] = [];
    groupedChildItems.forEach(groupItems => {
      groupItems.forEach(item => {
        if (item.shouldMerge && item.targetChild) {
          childMerges.push({
            sourceId: item.sourceChild.id,
            targetId: item.targetChild.id,
          });
        }
      });
    });
    onConfirm(childMerges);
  };
  
  // Stats
  const stats = useMemo(() => {
    let childrenMerge = 0;
    let childrenSeparate = 0;
    groupedChildItems.forEach(group => {
      group.forEach(item => {
        if (item.shouldMerge && item.targetChild) childrenMerge++;
        else childrenSeparate++;
      });
    });
    return {
      parents: data.parentMerges.length,
      childrenMerge,
      childrenSeparate,
    };
  }, [data.parentMerges.length, groupedChildItems]);
  
  const hasAnyChildren = groupedChildItems.some(g => g.length > 0);
  
  // Get display couple groups (use coupleGroups if available, otherwise create a default)
  const displayGroups = useMemo(() => {
    if (hasCoupleGroups) return data.coupleGroups;
    // Backward compat: create a single default group
    if (data.allSourceChildren.length > 0 || data.allTargetChildren.length > 0) {
      return [{
        label: 'Farzandlar',
        parentMerges: data.parentMerges,
        sourceChildren: data.allSourceChildren,
        targetChildren: data.allTargetChildren,
        childSuggestions: data.childSuggestions,
      }] as CoupleGroup[];
    }
    return [];
  }, [hasCoupleGroups, data]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Daraxtlarni birlashtirish
          </DialogTitle>
          <DialogDescription>
            {data.senderName} bilan {data.receiverName} ning oila daraxtlari birlashtirilmoqda
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {/* Avtomatik birlashadigan profillar */}
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
                        {merge.relationship === 'parent' ? 'Ota-ona' : 'Bobo-buvi'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Couple Groups - har bir juftlik uchun farzandlar */}
            {displayGroups.map((group, groupIdx) => {
              const groupItems = groupedChildItems[groupIdx] || [];
              if (groupItems.length === 0) return null;
              
              return (
                <div key={groupIdx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">
                      {group.label} - farzandlar
                    </h3>
                  </div>
                  
                  {/* Couple parent badges (compact) */}
                  {group.parentMerges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {group.parentMerges.map((pm, pmIdx) => (
                        <div
                          key={pmIdx}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-[10px]"
                        >
                          <span className="font-medium">{pm.sourceName}</span>
                          <span className="text-emerald-500">=</span>
                          <span className="font-medium">{pm.targetName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    ✓ belgilanganlari birlashadi, ✗ belgilanmagan alohida qoladi
                  </p>

                  {/* Juftlik (birlashish tavsiyasi) birinchi, keyin alohida farzandlar */}
                  {(() => {
                    const withIndex = groupItems.map((item, itemIdx) => ({ item, itemIdx }));
                    const coupled = withIndex.filter(({ item }) => item.targetChild != null);
                    const single = withIndex.filter(({ item }) => item.targetChild == null);
                    return (
                      <>
                        {coupled.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Birlashish tavsiyasi ({coupled.length})
                            </h4>
                            {coupled.map(({ item, itemIdx }) => (
                              <ChildMergeRow
                                key={itemIdx}
                                item={item}
                                onToggle={() => toggleMerge(groupIdx, itemIdx)}
                              />
                            ))}
                          </div>
                        )}
                        {single.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Alohida farzandlar ({single.length})
                            </h4>
                            {single.map(({ item, itemIdx }) => (
                              <ChildMergeRow
                                key={itemIdx}
                                item={item}
                                onToggle={() => toggleMerge(groupIdx, itemIdx)}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })}
            
            {!hasAnyChildren && data.parentMerges.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Birlashtiriladigan farzandlar yo'q
              </p>
            )}
          </div>
        </ScrollArea>
        
        {/* Summary */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground bg-muted/30 py-2 rounded-lg">
          {stats.parents > 0 && (
            <span className="flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-emerald-500" />
              Birlashish: <strong className="text-foreground">{stats.parents}</strong>
            </span>
          )}
          {hasAnyChildren && (
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
        <p className="text-[10px] text-muted-foreground">
          Yangi
          {item.similarity != null && (
            <span className="ml-1 text-emerald-600 font-medium">({item.similarity}% mos)</span>
          )}
        </p>
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
