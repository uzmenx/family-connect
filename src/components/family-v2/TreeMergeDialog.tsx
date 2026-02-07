import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, GitMerge, Loader2 } from 'lucide-react';
import { ChildrenMergeDialog } from './ChildrenMergeDialog';

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

interface ChildMergeData {
  parentDescription: string;
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  suggestedPairs: SuggestedPair[];
}

interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relationship: 'parent' | 'grandparent' | 'sibling';
}

interface TreeMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  autoMergeCandidates: MergeCandidate[];
  childMergeData: ChildMergeData | null;
  onAutoMergeComplete: () => Promise<void>;
  onMergeChild: (sourceId: string, targetId: string) => Promise<void>;
  senderName: string;
}

export const TreeMergeDialog = ({
  isOpen,
  onClose,
  autoMergeCandidates,
  childMergeData,
  onAutoMergeComplete,
  onMergeChild,
  senderName,
}: TreeMergeDialogProps) => {
  const [step, setStep] = useState<'merging' | 'children' | 'complete'>('merging');
  const [showChildrenDialog, setShowChildrenDialog] = useState(false);

  // Auto-execute parent merge when dialog opens
  useEffect(() => {
    if (!isOpen) {
      setStep('merging');
      return;
    }

    const runAutoMerge = async () => {
      // Execute auto merge silently
      await onAutoMergeComplete();

      // Check if we need to show children dialog
      if (childMergeData && 
          (childMergeData.sourceChildren.length > 0 || 
           childMergeData.targetChildren.length > 0)) {
        setStep('children');
        setShowChildrenDialog(true);
      } else {
        setStep('complete');
      }
    };

    // Small delay for UX
    const timer = setTimeout(runAutoMerge, 500);
    return () => clearTimeout(timer);
  }, [isOpen, onAutoMergeComplete, childMergeData]);

  // Handle children merge completion
  const handleChildrenComplete = async (
    merges: { sourceId: string; targetId: string }[],
    _separateIds: string[]
  ) => {
    // Execute each merge
    for (const merge of merges) {
      await onMergeChild(merge.sourceId, merge.targetId);
    }
    
    setShowChildrenDialog(false);
    setStep('complete');
  };

  const handleComplete = () => {
    setStep('merging');
    setShowChildrenDialog(false);
    onClose();
  };

  const parentCount = autoMergeCandidates.filter(c => c.relationship === 'parent').length;
  const grandparentCount = autoMergeCandidates.filter(c => c.relationship === 'grandparent').length;

  return (
    <>
      <Dialog open={isOpen && !showChildrenDialog} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Daraxtlar birlashmoqda
            </DialogTitle>
            <DialogDescription>
              {senderName} bilan oila daraxtingiz birlashtirilmoqda
            </DialogDescription>
          </DialogHeader>

          {step === 'merging' && (
            <div className="py-8 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Ota-onalar avtomatik birlashtirilmoqda...
              </p>
              {parentCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {parentCount} ta ota-ona, {grandparentCount} ta buvi-bobo
                </p>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Birlashtirish tugadi!</h3>
              <p className="text-sm text-muted-foreground mb-1">
                Oila daraxtingiz muvaffaqiyatli birlashtirildi
              </p>
              {(parentCount > 0 || grandparentCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {parentCount > 0 && `${parentCount} ta ota-ona`}
                  {parentCount > 0 && grandparentCount > 0 && ', '}
                  {grandparentCount > 0 && `${grandparentCount} ta buvi-bobo`}
                  {' '}birlashtirildi
                </p>
              )}
              <Button onClick={handleComplete} className="mt-4">
                Daraxtga qaytish
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Children Merge Dialog */}
      {showChildrenDialog && childMergeData && (
        <ChildrenMergeDialog
          isOpen={showChildrenDialog}
          onClose={() => {
            setShowChildrenDialog(false);
            setStep('complete');
          }}
          sourceChildren={childMergeData.sourceChildren}
          targetChildren={childMergeData.targetChildren}
          suggestedPairs={childMergeData.suggestedPairs}
          parentDescription={childMergeData.parentDescription}
          onComplete={handleChildrenComplete}
        />
      )}
    </>
  );
};
