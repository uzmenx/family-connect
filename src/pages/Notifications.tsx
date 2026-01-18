import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Users } from 'lucide-react';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { useAuth } from '@/contexts/AuthContext';
import { InvitationCard } from '@/components/family/InvitationCard';

const Notifications = () => {
  const { user } = useAuth();
  const { invitations, respondToInvitation } = useFamilyTree();
  const [loadingInvitation, setLoadingInvitation] = useState<string | null>(null);

  // Filter invitations received by current user
  const receivedInvitations = invitations.filter(inv => inv.receiver_id === user?.id);

  const handleAccept = async (invitationId: string) => {
    setLoadingInvitation(invitationId);
    await respondToInvitation(invitationId, true);
    setLoadingInvitation(null);
  };

  const handleReject = async (invitationId: string) => {
    setLoadingInvitation(invitationId);
    await respondToInvitation(invitationId, false);
    setLoadingInvitation(null);
  };

  const hasNotifications = receivedInvitations.length > 0;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold">Bildirishnomalar</h1>
        </header>
        
        <div className="p-4 space-y-4">
          {/* Family invitations section */}
          {receivedInvitations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Oila daraxti taklifnomalari</h2>
              </div>
              <div className="space-y-3">
                {receivedInvitations.map((inv) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onAccept={() => handleAccept(inv.id)}
                    onReject={() => handleReject(inv.id)}
                    isLoading={loadingInvitation === inv.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasNotifications && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Hozircha bildirishnomalar yo'q</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
