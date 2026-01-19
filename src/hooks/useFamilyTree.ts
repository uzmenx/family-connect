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
  // Owner profile data (for showing who created this member)
  owner_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
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
  const [networkUsers, setNetworkUsers] = useState<string[]>([]);

  const targetUserId = userId || user?.id;

  // Get or create family network for user
  const ensureFamilyNetwork = useCallback(async (userId: string): Promise<string | null> => {
    try {
      // Check if user already has a network
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', userId)
        .single();

      if (profile?.family_network_id) {
        return profile.family_network_id;
      }

      // Create new network
      const { data: newNetwork, error: networkError } = await supabase
        .from('family_networks')
        .insert({})
        .select()
        .single();

      if (networkError) throw networkError;

      // Assign network to user
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ family_network_id: newNetwork.id })
        .eq('id', userId);

      if (updateError) throw updateError;

      return newNetwork.id;
    } catch (error) {
      console.error('Error ensuring family network:', error);
      return null;
    }
  }, []);

  // Get all users in the same family network
  const fetchNetworkUsers = useCallback(async () => {
    if (!targetUserId) return [];

    try {
      // First get the user's network
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', targetUserId)
        .single();

      if (!profile?.family_network_id) {
        // User doesn't have a network yet, just return themselves
        setNetworkUsers([targetUserId]);
        return [targetUserId];
      }

      // Get all users in this network
      const { data: networkProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', profile.family_network_id);

      const users = networkProfiles?.map(p => p.id) || [targetUserId];
      setNetworkUsers(users);
      return users;
    } catch (error) {
      console.error('Error fetching network users:', error);
      return [targetUserId];
    }
  }, [targetUserId]);

  // Merge two family networks when invitation is accepted
  const mergeNetworks = useCallback(async (user1Id: string, user2Id: string): Promise<boolean> => {
    try {
      // Get both users' networks
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, family_network_id')
        .in('id', [user1Id, user2Id]);

      if (!profiles || profiles.length !== 2) return false;

      const network1 = profiles.find(p => p.id === user1Id)?.family_network_id;
      const network2 = profiles.find(p => p.id === user2Id)?.family_network_id;

      // If both have the same network, nothing to merge
      if (network1 && network1 === network2) return true;

      // Determine target network (prefer existing one)
      let targetNetworkId = network1 || network2;

      // If neither has a network, create one
      if (!targetNetworkId) {
        targetNetworkId = await ensureFamilyNetwork(user1Id);
        if (!targetNetworkId) return false;
      }

      // Move all users from network2 to network1 (if network2 exists and is different)
      if (network2 && network2 !== targetNetworkId) {
        const { error: moveError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('family_network_id', network2);

        if (moveError) throw moveError;
      }

      // Make sure both users are in the target network
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ family_network_id: targetNetworkId })
        .in('id', [user1Id, user2Id]);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Error merging networks:', error);
      return false;
    }
  }, [ensureFamilyNetwork]);

  const fetchMembers = useCallback(async () => {
    if (!targetUserId) return;

    try {
      // First get all users in the network
      const users = await fetchNetworkUsers();

      // Fetch all members from all users in the network
      const { data, error } = await supabase
        .from('family_tree_members')
        .select('*')
        .in('owner_id', users)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get all unique owner_ids and linked_user_ids to fetch profiles
      const ownerIds = [...new Set((data || []).map(m => m.owner_id))];
      const linkedUserIds = [...new Set((data || []).filter(m => m.linked_user_id).map(m => m.linked_user_id))];
      const allProfileIds = [...new Set([...ownerIds, ...linkedUserIds.filter(Boolean)])];

      // Fetch all profiles in one query
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, gender')
        .in('id', allProfileIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Map members with profiles
      const membersWithProfiles: FamilyMember[] = (data || []).map(member => {
        const ownerProfile = profilesMap.get(member.owner_id);
        const linkedProfile = member.linked_user_id ? profilesMap.get(member.linked_user_id) : null;

        return {
          ...member,
          gender: member.gender as 'male' | 'female' | null,
          linked_profile: linkedProfile ? {
            id: linkedProfile.id,
            name: linkedProfile.name,
            username: linkedProfile.username,
            avatar_url: linkedProfile.avatar_url,
            gender: linkedProfile.gender
          } : null,
          owner_profile: ownerProfile ? {
            id: ownerProfile.id,
            name: ownerProfile.name,
            username: ownerProfile.username,
            avatar_url: ownerProfile.avatar_url
          } : null
        };
      });

      setMembers(membersWithProfiles);
    } catch (error: any) {
      console.error('Error fetching family members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, fetchNetworkUsers]);

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

  // Subscribe to realtime updates for invitations and family members
  useEffect(() => {
    if (!user?.id) return;

    const invitationsChannel = supabase
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

    const membersChannel = supabase
      .channel('family_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_tree_members'
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invitationsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [user?.id, fetchInvitations, fetchMembers]);

  const addMember = async (memberData: {
    member_name: string;
    relation_type: string;
    avatar_url?: string;
    gender?: 'male' | 'female';
  }) => {
    if (!user?.id) return null;

    try {
      // Ensure user has a network before adding member
      await ensureFamilyNetwork(user.id);

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
        // Merge the family networks of sender and receiver
        await mergeNetworks(invitation.sender_id, user.id);

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
        description: accept ? "Siz oila daraxtiga qo'shildingiz va endi barcha a'zolarni ko'rishingiz mumkin" : "Taklifnoma rad etildi",
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
    networkUsers,
    addMember,
    sendInvitation,
    respondToInvitation,
    linkExistingMemberToUser,
    deleteMember,
    refetch: fetchMembers,
    refetchInvitations: fetchInvitations,
  };
};
