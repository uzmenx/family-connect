import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  RINGTONE_OPTIONS, 
  getSelectedRingtone, 
  setSelectedRingtone, 
  previewRingtone, 
  stopRingtone 
} from '@/lib/pushNotifications';

interface RingtoneSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RingtoneSelector = ({ open, onOpenChange }: RingtoneSelectorProps) => {
  const [selected, setSelected] = useState(getSelectedRingtone());
  const [playing, setPlaying] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelected(id);
    setSelectedRingtone(id);
  };

  const handlePreview = (id: string) => {
    if (playing === id) {
      stopRingtone();
      setPlaying(null);
    } else {
      previewRingtone(id);
      setPlaying(id);
      // Auto-stop after pattern plays
      setTimeout(() => setPlaying(null), 3000);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      stopRingtone();
      setPlaying(null);
    }
    onOpenChange(val);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[50vh]">
        <SheetHeader>
          <SheetTitle>🔔 Qo'ng'iroq ovozi</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {RINGTONE_OPTIONS.map((ringtone) => (
            <div
              key={ringtone.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                selected === ringtone.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
              onClick={() => handleSelect(ringtone.id)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(ringtone.id);
                }}
              >
                {playing === ringtone.id ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <span className="flex-1 text-sm font-medium">{ringtone.name}</span>
              {selected === ringtone.id && (
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
