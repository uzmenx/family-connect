import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTreeMerging } from './useTreeMerging';

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

export const useFamilyInvitations = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { findMergeCandidates, executeAutoMerge, mergeChildren } = useTreeMerging();
  
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeData, setMergeData] = useState<{
    autoMergeCandidates: MergeCandidate[];
    childrenToMerge: ChildMergeCandidate[];
    senderId: string;
    senderName: string;
  } | null>(null);

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

  /**
   * Link two users to the same family network
   * Takes the sender's network and adds the receiver to it
   */
  const linkToSameNetwork = async (senderId: string, receiverId: string): Promise<string | null> => {
    try {
      // Get sender's network
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', senderId)
        .single();
      
      let networkId = senderProfile?.family_network_id;
      
      // If sender doesn't have a network, create one
      if (!networkId) {
        const { data: newNetwork } = await supabase
          .from('family_networks')
          .insert({})
          .select('id')
          .single();
        
        if (newNetwork) {
          networkId = newNetwork.id;
          await supabase
            .from('profiles')
            .update({ family_network_id: networkId })
            .eq('id', senderId);
        }
      }
      
      if (!networkId) return null;
      
      // Add receiver to the same network
      await supabase
        .from('profiles')
        .update({ family_network_id: networkId })
        .eq('id', receiverId);
      
      return networkId;
    } catch (error) {
      console.error('Error linking to network:', error);
      return null;
    }
  };

  // Accept invitation - link user to member and trigger merge
  const acceptInvitation = async (invitation: FamilyInvitation) => {
    if (!user?.id || !profile) return false;

    try {
      // 1. Update invitation status
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // 2. Link both users to the same family network
      const networkId = await linkToSameNetwork(invitation.sender_id, user.id);
      if (networkId) {
        // Refresh profile to get new network ID
        await refreshProfile?.();
      }

      // 3. Link user to the family member placeholder
      const { error: linkError } = await supabase
        .from('family_tree_members')
        .update({ 
          linked_user_id: user.id,
          member_name: profile.name || profile.username || 'Foydalanuvchi',
          avatar_url: profile.avatar_url,
          is_placeholder: false,
          gender: profile.gender || undefined,
        })
        .eq('id', invitation.member_id);

      if (linkError) throw linkError;

      // 4. Create notification for sender
      await supabase.from('notifications').insert({
        user_id: invitation.sender_id,
        actor_id: user.id,
        type: 'family_invitation_accepted',
      });

      // 5. Find merge candidates (parents/grandparents that are the same person)
      const candidates = await findMergeCandidates(
        invitation.sender_id,
        user.id,
        invitation.member_id
      );

      // 6. If there are candidates to merge, show dialog
      if (candidates.autoMergeable.length > 0 || candidates.childrenToMerge.length > 0) {
        setMergeData({
          autoMergeCandidates: candidates.autoMergeable,
          childrenToMerge: candidates.childrenToMerge,
          senderId: invitation.sender_id,
          senderName: invitation.sender?.name || invitation.sender?.username || 'Foydalanuvchi',
        });
        setShowMergeDialog(true);
      } else {
        toast({
          title: "Qabul qilindi!",
          description: "Siz oila daraxtiga muvaffaqiyatli qo'shildingiz. Tarmoqlar birlashtirildi.",
        });
      }

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

  // Confirm auto merge (parents/grandparents)
  const confirmAutoMerge = async () => {
    if (!mergeData || !user?.id) return;
    
    const success = await executeAutoMerge(
      mergeData.senderId,
      user.id,
      mergeData.autoMergeCandidates
    );
    
    if (success) {
      toast({
        title: "Birlashtirildi!",
        description: `${mergeData.autoMergeCandidates.length} ta profil avtomatik birlashtirildi`,
      });
    }
  };

  // Merge specific children
  const handleMergeChildren = async (sourceId: string, targetId: string) => {
    if (!mergeData || !user?.id) return;
    
    const success = await mergeChildren(sourceId, targetId, mergeData.senderId, user.id);
    if (success) {
      toast({
        title: "Birlashtirildi!",
        description: "Farzand profillari muvaffaqiyatli birlashtirildi",
      });
    }
  };

  // Close merge dialog
  const closeMergeDialog = () => {
    setShowMergeDialog(false);
    setMergeData(null);
    toast({
      title: "Birlashtirish tugadi!",
      description: "Oila daraxtingiz muvaffaqiyatli birlashtirildi. Sahifani yangilang.",
    });
    // Reload page to show merged tree
    window.location.reload();
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
    // Merge dialog
    showMergeDialog,
    mergeData,
    confirmAutoMerge,
    handleMergeChildren,
    closeMergeDialog,
  };
};
