import { useState } from 'react';
import { Edit2, Trash2, ImagePlus, Users, UserPlus, Baby, Send } from 'lucide-react';
import { FamilyMember } from '@/types/family';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember;
  onUpdate: (id: string, updates: Partial<FamilyMember>) => void;
  onDelete: (id: string) => void;
  onAddParents?: (id: string) => void;
  onAddSpouse?: (id: string) => void;
  onAddChild?: (id: string) => void;
  onSendInvitation?: (member: FamilyMember) => void;
  hasParents?: boolean;
  hasSpouse?: boolean;
  canAddChild?: boolean;
}

export const ProfileModal = ({
  isOpen,
  onClose,
  member,
  onUpdate,
  onDelete,
  onAddParents,
  onAddSpouse,
  onAddChild,
  onSendInvitation,
  hasParents = false,
  hasSpouse = false,
  canAddChild = false,
}: ProfileModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [birthYear, setBirthYear] = useState(member.birthYear?.toString() || '');
  const [deathYear, setDeathYear] = useState(member.deathYear?.toString() || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');

  const hasChanges = 
    name !== member.name ||
    birthYear !== (member.birthYear?.toString() || '') ||
    deathYear !== (member.deathYear?.toString() || '') ||
    photoUrl !== (member.photoUrl || '');

  const handleSave = () => {
    onUpdate(member.id, {
      name: name || "Noma'lum",
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      deathYear: deathYear ? parseInt(deathYear) : undefined,
      photoUrl: photoUrl || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(member.name);
    setBirthYear(member.birthYear?.toString() || '');
    setDeathYear(member.deathYear?.toString() || '');
    setPhotoUrl(member.photoUrl || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("Ushbu a'zoni o'chirmoqchimisiz?")) {
      onDelete(member.id);
      onClose();
    }
  };

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  const yearDisplay = member.birthYear 
    ? `${member.birthYear}${member.deathYear ? ` - ${member.deathYear}` : ''}`
    : '';

  const isMale = member.gender === 'male';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <DialogTitle className="text-center flex-1">Profil</DialogTitle>
            <div className="w-8" />
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Photo */}
          <div className="flex justify-center">
            <div 
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center shadow-lg",
                "transition-all duration-200",
                isEditing && "cursor-pointer hover:scale-105",
                isMale ? "bg-sky-500" : "bg-pink-500"
              )}
            >
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={member.name} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : isEditing ? (
                <ImagePlus className="w-10 h-10 text-white/80" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {(member.name || '?')[0]?.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {isEditing ? (
            <>
              {/* Name Input */}
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ism kiriting"
                className="text-center text-lg font-medium"
                autoFocus
              />

              {/* Photo URL */}
              <Input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Rasm URL (ixtiyoriy)"
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  Bekor qilish
                </Button>
                {hasChanges && (
                  <Button onClick={handleSave} className="flex-1">
                    Saqlash
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Name Display */}
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-foreground">
                  {member.name || "Noma'lum"}
                </h3>
                {yearDisplay && (
                  <p className={cn(
                    "mt-2 inline-block px-3 py-1 rounded-full text-sm",
                    isMale 
                      ? "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300" 
                      : "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300"
                  )}>
                    {yearDisplay}
                  </p>
                )}
              </div>

              {/* Action Buttons - Ota-ona, Juft, Farzand, Taklif */}
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {!hasParents && onAddParents && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddParents(member.id))}
                    className="flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    Ota-ona
                  </Button>
                )}
                
                {!hasSpouse && onAddSpouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddSpouse(member.id))}
                    className="flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    Juft
                  </Button>
                )}
                
                {canAddChild && onAddChild && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddChild(member.id))}
                    className="flex items-center gap-1.5"
                  >
                    <Baby className="w-4 h-4" />
                    Farzand
                  </Button>
                )}

                {member.name && !member.linkedUserId && onSendInvitation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onSendInvitation(member))}
                    className="flex items-center gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Send className="w-4 h-4" />
                    Taklif
                  </Button>
                )}
              </div>

              {/* Edit Button */}
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Tahrirlash
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
