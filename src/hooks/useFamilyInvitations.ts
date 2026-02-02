import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface FamilyInvitation {
  id: string;
  sender_id: string;
  receiver_id: string;
  member_id: string;
  relation_type: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useFamilyInvitations = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch pending invitations for current user
  const fetchInvitations = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch sender profiles
        const senderIds = [...new Set(data.map(inv => inv.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', senderIds);

        const enriched = data.map(inv => ({
          ...inv,
          status: inv.status as 'pending' | 'accepted' | 'rejected',
          sender: profiles?.find(p => p.id === inv.sender_id),
        }));

        setPendingInvitations(enriched);
      } else {
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Accept invitation - link user to member and merge trees
  const acceptInvitation = async (invitation: FamilyInvitation) => {
    if (!user?.id || !profile) return false;

    try {
      // 1. Update invitation status
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // 2. Link user to the family member
      const { error: linkError } = await supabase
        .from('family_tree_members')
        .update({ 
          linked_user_id: user.id,
          member_name: profile.name || profile.username || 'Foydalanuvchi',
          avatar_url: profile.avatar_url,
          is_placeholder: false,
        })
        .eq('id', invitation.member_id);

      if (linkError) throw linkError;

      // 3. Create notification for sender
      await supabase.from('notifications').insert({
        user_id: invitation.sender_id,
        actor_id: user.id,
        type: 'family_invitation_accepted',
      });

      toast({
        title: "Qabul qilindi!",
        description: "Siz oila daraxtiga muvaffaqiyatli qo'shildingiz",
      });

      // Remove from pending list
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      
      return true;
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Xato",
        description: error.message || "Taklifni qabul qilishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  // Reject invitation
  const rejectInvitation = async (invitation: FamilyInvitation) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('family_invitations')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: "Rad etildi",
        description: "Taklifnoma rad etildi",
      });

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      return true;
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      toast({
        title: "Xato",
        description: error.message || "Taklifni rad etishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('family_invitations_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_invitations',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchInvitations]);

  return {
    pendingInvitations,
    isLoading,
    fetchInvitations,
    acceptInvitation,
    rejectInvitation,
  };
};
