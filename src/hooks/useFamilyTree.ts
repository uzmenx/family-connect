import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface FamilyMember {
  id: string;
  owner_id: string;
  linked_user_id: string | null;
  member_name: string;
  relation_type: string;
  avatar_url: string | null;
  gender: 'male' | 'female' | null;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
  // Joined profile data for linked users
  linked_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    gender: string | null;
  } | null;
}

export interface FamilyInvitation {
  id: string;
  sender_id: string;
  receiver_id: string;
  member_id: string;
  relation_type: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  // Joined data
  sender_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  member?: FamilyMember | null;
}

export const useFamilyTree = (userId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetUserId = userId || user?.id;

  const fetchMembers = useCallback(async () => {
    if (!targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch linked profiles for members with linked_user_id
      const membersWithProfiles = await Promise.all(
        (data || []).map(async (member) => {
          if (member.linked_user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, name, username, avatar_url, gender')
              .eq('id', member.linked_user_id)
              .single();
            return { 
              ...member, 
              gender: member.gender as 'male' | 'female' | null,
              linked_profile: profileData 
            };
          }
          return { 
            ...member, 
            gender: member.gender as 'male' | 'female' | null,
            linked_profile: null 
          };
        })
      );

      setMembers(membersWithProfiles);
    } catch (error: any) {
      console.error('Error fetching family members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  const fetchInvitations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      const invitationsWithData = await Promise.all(
        (data || []).map(async (inv) => {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', inv.sender_id)
            .single();

          const { data: memberData } = await supabase
            .from('family_tree_members')
            .select('*')
            .eq('id', inv.member_id)
            .single();

          return {
            ...inv,
            status: inv.status as 'pending' | 'accepted' | 'rejected',
            sender_profile: senderProfile,
            member: memberData ? {
              ...memberData,
              gender: memberData.gender as 'male' | 'female' | null,
              linked_profile: null
            } : null
          };
        })
      );

      setInvitations(invitationsWithData);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  // Subscribe to realtime updates for invitations
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('family_invitations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_invitations',
          filter: `receiver_id=eq.${user.id}`
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

  const addMember = async (memberData: {
    member_name: string;
    relation_type: string;
    avatar_url?: string;
    gender?: 'male' | 'female';
  }) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: memberData.member_name,
          relation_type: memberData.relation_type,
          avatar_url: memberData.avatar_url || null,
          gender: memberData.gender || null,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Qo'shildi!",
        description: `${memberData.member_name} oila daraxtiga qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const sendInvitation = async (receiverId: string, memberId: string, relationType: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('family_invitations')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          member_id: memberId,
          relation_type: relationType,
        });

      if (error) throw error;

      toast({
        title: "Yuborildi!",
        description: "Taklifnoma muvaffaqiyatli yuborildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    if (!user?.id) return false;

    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return false;

      // Update invitation status
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      if (accept) {
        // Link the user to the family member
        const { error: linkError } = await supabase
          .from('family_tree_members')
          .update({ 
            linked_user_id: user.id,
            is_placeholder: false 
          })
          .eq('id', invitation.member_id);

        if (linkError) throw linkError;
      }

      await fetchInvitations();
      await fetchMembers();

      toast({
        title: accept ? "Qabul qilindi!" : "Rad etildi",
        description: accept ? "Siz oila daraxtiga qo'shildingiz" : "Taklifnoma rad etildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const linkExistingMemberToUser = async (memberId: string, targetUserId: string) => {
    if (!user?.id) return false;

    try {
      // First check if there's already a pending invitation
      const { data: existing } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('member_id', memberId)
        .eq('receiver_id', targetUserId)
        .eq('status', 'pending')
        .single();

      if (existing) {
        toast({
          title: "Taklifnoma mavjud",
          description: "Bu inson uchun allaqachon taklifnoma yuborilgan",
        });
        return false;
      }

      // Get the member to send invitation
      const member = members.find(m => m.id === memberId);
      if (!member) return false;

      return await sendInvitation(targetUserId, memberId, member.relation_type);
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('family_tree_members')
        .delete()
        .eq('id', memberId)
        .eq('owner_id', user.id);

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "O'chirildi!",
        description: "Qarindosh oila daraxtidan o'chirildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    members,
    invitations,
    isLoading,
    addMember,
    sendInvitation,
    respondToInvitation,
    linkExistingMemberToUser,
    deleteMember,
    refetch: fetchMembers,
    refetchInvitations: fetchInvitations,
  };
};
