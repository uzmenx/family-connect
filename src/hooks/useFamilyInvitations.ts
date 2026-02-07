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

export const useFamilyInvitations = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { findMergeCandidates, executeAutoMerge, mergeChild } = useTreeMerging();
  
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeData, setMergeData] = useState<{
    autoMergeCandidates: MergeCandidate[];
    childMergeData: ChildMergeData | null;
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
   */
  const linkToSameNetwork = async (senderId: string, receiverId: string): Promise<string | null> => {
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', senderId)
        .single();
      
      let networkId = senderProfile?.family_network_id;
      
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

  // Accept invitation
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

      // 4. Create notification
      await supabase.from('notifications').insert({
        user_id: invitation.sender_id,
        actor_id: user.id,
        type: 'family_invitation_accepted',
      });

      // 5. Find merge candidates
      const candidates = await findMergeCandidates(
        invitation.sender_id,
        user.id,
        invitation.member_id
      );

      // 6. Show merge dialog if there are candidates
      if (candidates.autoMergeable.length > 0 || candidates.childMergeData) {
        setMergeData({
          autoMergeCandidates: candidates.autoMergeable,
          childMergeData: candidates.childMergeData,
          senderId: invitation.sender_id,
          senderName: invitation.sender?.name || invitation.sender?.username || 'Foydalanuvchi',
        });
        setShowMergeDialog(true);
      } else {
        toast({
          title: "Qabul qilindi!",
          description: "Siz oila daraxtiga muvaffaqiyatli qo'shildingiz.",
        });
      }

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error accepting invitation:', err);
      toast({
        title: "Xato",
        description: err.message || "Taklifni qabul qilishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  // Execute auto merge (parents/grandparents)
  const confirmAutoMerge = async () => {
    if (!mergeData) return;
    
    const success = await executeAutoMerge(mergeData.autoMergeCandidates);
    
    if (success) {
      toast({
        title: "Birlashtirildi!",
        description: `${mergeData.autoMergeCandidates.length} ta profil avtomatik birlashtirildi`,
      });
    }
  };

  // Merge specific child
  const handleMergeChild = async (sourceId: string, targetId: string) => {
    const success = await mergeChild(sourceId, targetId);
    if (success) {
      toast({
        title: "Birlashtirildi!",
        description: "Farzand profillari birlashtirildi",
      });
    }
  };

  // Close merge dialog
  const closeMergeDialog = () => {
    setShowMergeDialog(false);
    setMergeData(null);
    toast({
      title: "Birlashtirish tugadi!",
      description: "Oila daraxtingiz muvaffaqiyatli birlashtirildi.",
    });
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
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error rejecting invitation:', err);
      toast({
        title: "Xato",
        description: err.message || "Taklifni rad etishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

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
    handleMergeChild,
    closeMergeDialog,
  };
};
