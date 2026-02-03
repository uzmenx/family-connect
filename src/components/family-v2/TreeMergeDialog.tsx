import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, ArrowRight, GitMerge, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
  autoMerge: boolean;
}

interface ChildMergeCandidate {
  sourceChildren: { id: string; name: string }[];
  targetChildren: { id: string; name: string }[];
  parentDescription: string;
}

interface TreeMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  autoMergeCandidates: MergeCandidate[];
  childrenToMerge: ChildMergeCandidate[];
  onConfirmAutoMerge: () => Promise<void>;
  onMergeChildren: (sourceId: string, targetId: string) => Promise<void>;
  senderName: string;
}

export const TreeMergeDialog = ({
  isOpen,
  onClose,
  autoMergeCandidates,
  childrenToMerge,
  onConfirmAutoMerge,
  onMergeChildren,
  senderName,
}: TreeMergeDialogProps) => {
  const [step, setStep] = useState<'auto' | 'children' | 'complete'>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [childMergeMap, setChildMergeMap] = useState<Map<string, string>>(new Map());
  const [selectedSourceChild, setSelectedSourceChild] = useState<string | null>(null);

  const handleConfirmAuto = async () => {
    setIsProcessing(true);
    await onConfirmAutoMerge();
    setIsProcessing(false);
    
    if (childrenToMerge.length > 0) {
      setStep('children');
    } else {
      setStep('complete');
    }
  };

  const handleSelectTargetChild = async (targetId: string) => {
    if (!selectedSourceChild) return;
    
    setIsProcessing(true);
    await onMergeChildren(selectedSourceChild, targetId);
    
    setChildMergeMap(prev => new Map(prev).set(selectedSourceChild, targetId));
    setSelectedSourceChild(null);
    setIsProcessing(false);
  };

  const handleComplete = () => {
    setStep('auto');
    setChildMergeMap(new Map());
    setSelectedSourceChild(null);
    onClose();
  };

  const getRelationshipLabel = (rel: string) => {
    switch (rel) {
      case 'parent': return 'Ota-ona';
      case 'grandparent': return 'Buvi-bobo';
      case 'sibling': return 'Aka-uka/Opa-singil';
      default: return rel;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Daraxtlarni birlashtirish
          </DialogTitle>
          <DialogDescription>
            {senderName} bilan oila daraxtingiz birlashtirilmoqda
          </DialogDescription>
        </DialogHeader>

        {step === 'auto' && (
          <div className="space-y-4">
            {autoMergeCandidates.length > 0 ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                  <Check className="h-5 w-5 text-primary" />
                  <span className="text-sm">
                    Bu profillar avtomatik birlashtiriladi (bir xil odam)
                  </span>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {autoMergeCandidates.map((candidate, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {getRelationshipLabel(candidate.relationship)}
                        </Badge>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="truncate font-medium">{candidate.sourceName}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate text-muted-foreground">{candidate.targetName}</span>
                        </div>
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} className="flex-1">
                    Bekor qilish
                  </Button>
                  <Button 
                    onClick={handleConfirmAuto} 
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? 'Birlashtirilmoqda...' : 'Tasdiqlash'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Avtomatik birlashtiradigan profillar topilmadi
                </p>
                <Button onClick={handleComplete} className="mt-4">
                  Davom etish
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'children' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm">
                Farzandlarni qo'lda birlashtirishingiz kerak
              </span>
            </div>

            {childrenToMerge.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-3">
                <h4 className="font-medium text-sm">{group.parentDescription}</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Source children (sender's tree) */}
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground block mb-2">
                      {senderName} daraxtida
                    </span>
                    {group.sourceChildren.map(child => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedSourceChild(child.id)}
                        disabled={childMergeMap.has(child.id)}
                        className={cn(
                          "w-full p-2 rounded-lg border text-left text-sm transition-colors",
                          selectedSourceChild === child.id
                            ? "border-primary bg-primary/10"
                            : childMergeMap.has(child.id)
                            ? "border-muted bg-muted/50 text-muted-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {child.name}
                        {childMergeMap.has(child.id) && (
                          <Check className="h-4 w-4 inline ml-2 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Target children (receiver's tree) */}
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground block mb-2">
                      Sizning daraxtingizda
                    </span>
                    {group.targetChildren.map(child => (
                      <button
                        key={child.id}
                        onClick={() => handleSelectTargetChild(child.id)}
                        disabled={
                          !selectedSourceChild || 
                          Array.from(childMergeMap.values()).includes(child.id)
                        }
                        className={cn(
                          "w-full p-2 rounded-lg border text-left text-sm transition-colors",
                          Array.from(childMergeMap.values()).includes(child.id)
                            ? "border-muted bg-muted/50 text-muted-foreground"
                            : selectedSourceChild
                            ? "border-border hover:border-primary/50 cursor-pointer"
                            : "border-border opacity-50"
                        )}
                      >
                        {child.name}
                        {Array.from(childMergeMap.values()).includes(child.id) && (
                          <Check className="h-4 w-4 inline ml-2 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('auto')} className="flex-1">
                Orqaga
              </Button>
              <Button onClick={() => setStep('complete')} className="flex-1">
                Tugatish
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Birlashtirish tugadi!</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Oila daraxtingiz muvaffaqiyatli birlashtirildi
            </p>
            <Button onClick={handleComplete}>
              Daraxtga qaytish
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
