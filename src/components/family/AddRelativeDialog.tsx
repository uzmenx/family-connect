import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Relative } from '@/types';

interface AddRelativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (relative: Omit<Relative, 'id' | 'user_id' | 'created_at'>) => void;
  relatives: Relative[];
}

const relationTypes = [
  { value: 'father', label: 'Ota' },
  { value: 'mother', label: 'Ona' },
  { value: 'sibling', label: 'Aka/Uka/Opa/Singil' },
  { value: 'child', label: 'Farzand' },
  { value: 'spouse', label: "Turmush o'rtog'i" },
  { value: 'grandparent', label: 'Buvi/Bobiyo' },
  { value: 'grandchild', label: 'Nevara' },
  { value: 'uncle', label: 'Tog\'a/Amaki' },
  { value: 'aunt', label: 'Xola/Amma' },
  { value: 'cousin', label: 'Amakivachcha' },
];

export const AddRelativeDialog = ({ open, onOpenChange, onAdd, relatives }: AddRelativeDialogProps) => {
  const [name, setName] = useState('');
  const [relationType, setRelationType] = useState<Relative['relation_type']>('father');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      relative_name: name,
      relation_type: relationType,
      avatar_url: avatarUrl,
      parent_relative_id: parentId,
    });
    setName('');
    setRelationType('father');
    setAvatarUrl('');
    setParentId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Qarindosh qo'shish</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ism</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Qarindosh ismi"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Qarindoshlik turi</Label>
            <Select value={relationType} onValueChange={(v) => setRelationType(v as Relative['relation_type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar URL (ixtiyoriy)</Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          {relatives.length > 0 && (
            <div className="space-y-2">
              <Label>Bog'lash (ixtiyoriy)</Label>
              <Select value={parentId || ''} onValueChange={(v) => setParentId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qarindoshni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Hech kim</SelectItem>
                  {relatives.map((rel) => (
                    <SelectItem key={rel.id} value={rel.id}>
                      {rel.relative_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="flex-1">
              Qo'shish
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
