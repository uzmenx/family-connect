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
import { Check, ArrowRight, GitMerge, Users } from 'lucide-react';
import { ChildrenMergeDialog } from './ChildrenMergeDialog';

interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
  autoMerge: boolean;
}

interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

interface ChildMergeCandidate {
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
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
  const [currentChildGroup, setCurrentChildGroup] = useState(0);
  const [showChildrenDialog, setShowChildrenDialog] = useState(false);

  const handleConfirmAuto = async () => {
    setIsProcessing(true);
    await onConfirmAutoMerge();
    setIsProcessing(false);
    
    if (childrenToMerge.length > 0) {
      setCurrentChildGroup(0);
      setShowChildrenDialog(true);
      setStep('children');
    } else {
      setStep('complete');
    }
  };

  const handleChildrenMergeComplete = async (
    merges: { sourceId: string; targetId: string }[],
    _separates: string[]
  ) => {
    // Process each merge
    for (const merge of merges) {
      await onMergeChildren(merge.sourceId, merge.targetId);
    }
    
    // Move to next group or complete
    if (currentChildGroup < childrenToMerge.length - 1) {
      setCurrentChildGroup(prev => prev + 1);
    } else {
      setShowChildrenDialog(false);
      setStep('complete');
    }
  };

  const handleComplete = () => {
    setStep('auto');
    setCurrentChildGroup(0);
    setShowChildrenDialog(false);
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

  // Get current children group for dialog
  const currentGroup = childrenToMerge[currentChildGroup];

  return (
    <>
      <Dialog open={isOpen && step !== 'children'} onOpenChange={onClose}>
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

      {/* Children Merge Dialog - shown separately for better UX */}
      {showChildrenDialog && currentGroup && (
        <ChildrenMergeDialog
          isOpen={showChildrenDialog}
          onClose={() => {
            setShowChildrenDialog(false);
            setStep('complete');
          }}
          sourceChildren={currentGroup.sourceChildren}
          targetChildren={currentGroup.targetChildren}
          parentDescription={currentGroup.parentDescription}
          onComplete={handleChildrenMergeComplete}
        />
      )}
    </>
  );
};
