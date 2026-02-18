import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type PostCollection } from '@/hooks/usePostCollections';

interface CollectionsFilterProps {
  collections: PostCollection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isOwner: boolean;
  onCreateCollection?: (name: string) => void;
}

export function CollectionsFilter({ collections, selectedId, onSelect, isOwner, onCreateCollection }: CollectionsFilterProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  if (collections.length === 0 && !isOwner) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection?.(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 px-4 mb-3" style={{ scrollbarWidth: 'none' }}>
        {collections.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(selectedId === c.id ? null : c.id)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              selectedId === c.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
            )}
          >
            {c.name}
          </button>
        ))}

        {isOwner && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-border text-muted-foreground hover:bg-secondary/50 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Yangi
          </button>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi ro'yxat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ro'yxat nomi"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button className="w-full" onClick={handleCreate} disabled={!newName.trim()}>
              Yaratish
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
