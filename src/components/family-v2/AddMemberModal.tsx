import { useState, useEffect } from 'react';
import { X, ImagePlus } from 'lucide-react';
import { AddMemberData, AddMemberType } from '@/types/family';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AddMemberData) => void;
  type: AddMemberType;
  gender?: 'male' | 'female';
  title: string;
  showNextPrompt?: boolean;
  nextPromptText?: string;
}

export const AddMemberModal = ({
  isOpen,
  onClose,
  onSave,
  type,
  gender: initialGender = 'male',
  title,
  showNextPrompt,
  nextPromptText,
}: AddMemberModalProps) => {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [deathYear, setDeathYear] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>(initialGender);

  const gender = type === 'child' ? selectedGender : initialGender;

  useEffect(() => {
    if (isOpen) {
      setName('');
      setBirthYear('');
      setDeathYear('');
      setPhotoUrl('');
      setHasChanges(false);
      setSelectedGender(initialGender);
    }
  }, [isOpen, initialGender]);

  useEffect(() => {
    const hasAnyValue = name || birthYear || deathYear || photoUrl;
    setHasChanges(!!hasAnyValue);
  }, [name, birthYear, deathYear, photoUrl]);

  const handleSave = () => {
    onSave({
      name: name || "Noma'lum",
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      deathYear: deathYear ? parseInt(deathYear) : undefined,
      gender,
      photoUrl: photoUrl || undefined,
    });
  };

  const handleLater = () => {
    onSave({
      name: '',
      gender,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Photo */}
          <div className="flex justify-center">
            <div 
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center cursor-pointer",
                "transition-all duration-200 hover:scale-105 border-2 border-dashed",
                gender === 'male' 
                  ? "border-sky-300 hover:border-sky-500 bg-sky-50 dark:bg-sky-950/30" 
                  : "border-pink-300 hover:border-pink-500 bg-pink-50 dark:bg-pink-950/30"
              )}
            >
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <ImagePlus className={cn(
                    "w-8 h-8 mx-auto",
                    gender === 'male' ? "text-sky-500" : "text-pink-500"
                  )} />
                  <span className="text-xs text-muted-foreground mt-1 block">Rasm</span>
                </div>
              )}
            </div>
          </div>

          {/* Gender Selection for Child */}
          {type === 'child' && (
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant={selectedGender === 'male' ? 'default' : 'outline'}
                onClick={() => setSelectedGender('male')}
                className={cn(
                  "flex-1",
                  selectedGender === 'male' && "bg-sky-500 hover:bg-sky-600"
                )}
              >
                O'g'il
              </Button>
              <Button
                type="button"
                variant={selectedGender === 'female' ? 'default' : 'outline'}
                onClick={() => setSelectedGender('female')}
                className={cn(
                  "flex-1",
                  selectedGender === 'female' && "bg-pink-500 hover:bg-pink-600"
                )}
              >
                Qiz
              </Button>
            </div>
          )}

          {/* Name Input */}
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ism kiriting"
            autoFocus
          />

          {/* Year Inputs */}
          <div className="flex gap-3">
            <Input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="Tug'ilgan yili"
              min="1800"
              max={new Date().getFullYear()}
            />
            <Input
              type="number"
              value={deathYear}
              onChange={(e) => setDeathYear(e.target.value)}
              placeholder="Vafot yili"
              min="1800"
              max={new Date().getFullYear()}
            />
          </div>

          {/* Photo URL */}
          <Input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Rasm URL (ixtiyoriy)"
          />

          {/* Next Prompt Info */}
          {showNextPrompt && nextPromptText && (
            <div className="bg-primary/10 rounded-xl p-3 text-sm text-primary">
              {nextPromptText}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleLater}
              className="flex-1"
            >
              Keyinroq
            </Button>
            {hasChanges && (
              <Button
                onClick={handleSave}
                className="flex-1"
              >
                Saqlash
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
