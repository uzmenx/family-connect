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

// Relationship limits - vaqtinchalik 1 ta ota, 1 ta ona, 1 ta juft
export const FAMILY_LIMITS = {
  MAX_SPOUSES: 1,
  MAX_FATHERS: 1,
  MAX_MOTHERS: 1,
  MAX_CHILDREN: 8,
};

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
      console.log('Merging networks for users:', user1Id, user2Id);
      
      // Get both users' networks
      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, family_network_id')
        .in('id', [user1Id, user2Id]);

      if (fetchError) {
        console.error('Error fetching profiles:', fetchError);
        return false;
      }

      if (!profiles || profiles.length !== 2) {
        console.error('Could not find both profiles:', profiles);
        return false;
      }

      const profile1 = profiles.find(p => p.id === user1Id);
      const profile2 = profiles.find(p => p.id === user2Id);
      
      const network1 = profile1?.family_network_id;
      const network2 = profile2?.family_network_id;

      console.log('Current networks:', { network1, network2 });

      // If both have the same network, nothing to merge
      if (network1 && network1 === network2) {
        console.log('Users already in same network');
        return true;
      }

      // Determine target network
      let targetNetworkId: string | null = null;

      if (network1 && network2) {
        // Both have networks - merge network2 users into network1
        targetNetworkId = network1;
        
        const { error: moveError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('family_network_id', network2);

        if (moveError) {
          console.error('Error moving users from network2:', moveError);
          throw moveError;
        }
        console.log('Moved users from network2 to network1');
      } else if (network1) {
        // Only user1 has network - add user2 to it
        targetNetworkId = network1;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('id', user2Id);

        if (updateError) {
          console.error('Error adding user2 to network:', updateError);
          throw updateError;
        }
        console.log('Added user2 to network1');
      } else if (network2) {
        // Only user2 has network - add user1 to it
        targetNetworkId = network2;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('id', user1Id);

        if (updateError) {
          console.error('Error adding user1 to network:', updateError);
          throw updateError;
        }
        console.log('Added user1 to network2');
      } else {
        // Neither has a network - create one and add both
        const { data: newNetwork, error: networkError } = await supabase
          .from('family_networks')
          .insert({})
          .select()
          .single();

        if (networkError) {
          console.error('Error creating new network:', networkError);
          throw networkError;
        }

        targetNetworkId = newNetwork.id;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .in('id', [user1Id, user2Id]);

        if (updateError) {
          console.error('Error adding both users to new network:', updateError);
          throw updateError;
        }
        console.log('Created new network and added both users');
      }

      console.log('Networks merged successfully, target:', targetNetworkId);
      return true;
    } catch (error) {
      console.error('Error merging networks:', error);
      return false;
    }
  }, []);

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
      // Also delete any spouses of this member
      const spouseRelations = members.filter(m => 
        m.relation_type === `spouse_of_${memberId}` || 
        m.relation_type === `spouse_2_of_${memberId}`
      );
      
      // Also delete any children of this member
      const childRelations = members.filter(m => 
        m.relation_type === `child_of_${memberId}` ||
        m.relation_type.startsWith(`child_`) && m.relation_type.includes(memberId)
      );

      // Delete spouses first
      for (const spouse of spouseRelations) {
        await supabase
          .from('family_tree_members')
          .delete()
          .eq('id', spouse.id);
      }

      // Delete children
      for (const child of childRelations) {
        await supabase
          .from('family_tree_members')
          .delete()
          .eq('id', child.id);
      }

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

  // Count spouses for a member (faqat birinchi juft)
  const countSpousesForMember = (memberId: string): number => {
    return members.filter(m => 
      m.relation_type === `spouse_of_${memberId}`
    ).length;
  };

  // Count children for a member
  const countChildrenForMember = (memberId: string): number => {
    return members.filter(m => 
      m.relation_type.startsWith(`child_of_${memberId}`)
    ).length;
  };

  // Count parents (fathers) for a member (faqat birinchi ota)
  const countFathersForMember = (memberId: string): number => {
    return members.filter(m => 
      m.relation_type === `father_of_${memberId}`
    ).length;
  };

  // Count parents (mothers) for a member (faqat birinchi ona)
  const countMothersForMember = (memberId: string): number => {
    return members.filter(m => 
      m.relation_type === `mother_of_${memberId}`
    ).length;
  };

  // Add spouse to an existing member
  const addSpouseToMember = async (
    memberId: string, 
    spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string },
    isSecondSpouse: boolean = false
  ) => {
    if (!user?.id) return null;

    // Check spouse limit
    const currentSpouseCount = countSpousesForMember(memberId);
    if (currentSpouseCount >= FAMILY_LIMITS.MAX_SPOUSES) {
      toast({
        title: "Limit",
        description: `Maksimal ${FAMILY_LIMITS.MAX_SPOUSES} ta juft qo'shish mumkin`,
        variant: "destructive",
      });
      return null;
    }

    try {
      // Ensure user has a network before adding member
      await ensureFamilyNetwork(user.id);

      const relationType = isSecondSpouse ? `spouse_2_of_${memberId}` : `spouse_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: spouseData.name,
          relation_type: relationType,
          avatar_url: spouseData.avatarUrl || null,
          gender: spouseData.gender,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Juft qo'shildi!",
        description: `${spouseData.name} juft sifatida qo'shildi`,
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

  // Add child to a member (requires spouse)
  const addChildToMember = async (
    memberId: string,
    childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    // Check child limit
    const currentChildCount = countChildrenForMember(memberId);
    if (currentChildCount >= FAMILY_LIMITS.MAX_CHILDREN) {
      toast({
        title: "Limit",
        description: `Maksimal ${FAMILY_LIMITS.MAX_CHILDREN} ta farzand qo'shish mumkin`,
        variant: "destructive",
      });
      return null;
    }

    try {
      await ensureFamilyNetwork(user.id);

      const childNumber = currentChildCount + 1;
      const relationType = `child_of_${memberId}_${childNumber}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: childData.name,
          relation_type: relationType,
          avatar_url: childData.avatarUrl || null,
          gender: childData.gender,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Farzand qo'shildi!",
        description: `${childData.name} farzand sifatida qo'shildi`,
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

  // Add father to a member (faqat bitta ota)
  const addFatherToMember = async (
    memberId: string,
    fatherData: { name: string; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    try {
      // Fetch fresh data to get accurate count
      const { data: existingFathers, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .eq('owner_id', user.id)
        .eq('relation_type', `father_of_${memberId}`);

      if (countError) throw countError;

      const currentFatherCount = existingFathers?.length || 0;

      if (currentFatherCount >= FAMILY_LIMITS.MAX_FATHERS) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_FATHERS} ta ota qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      await ensureFamilyNetwork(user.id);

      const relationType = `father_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: fatherData.name,
          relation_type: relationType,
          avatar_url: fatherData.avatarUrl || null,
          gender: 'male',
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Ota qo'shildi!",
        description: `${fatherData.name} ota sifatida qo'shildi`,
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

  // Add mother to a member (faqat bitta ona)
  const addMotherToMember = async (
    memberId: string,
    motherData: { name: string; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    try {
      // Fetch fresh data to get accurate count
      const { data: existingMothers, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .eq('owner_id', user.id)
        .eq('relation_type', `mother_of_${memberId}`);

      if (countError) throw countError;

      const currentMotherCount = existingMothers?.length || 0;

      if (currentMotherCount >= FAMILY_LIMITS.MAX_MOTHERS) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_MOTHERS} ta ona qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      await ensureFamilyNetwork(user.id);

      const relationType = `mother_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: motherData.name,
          relation_type: relationType,
          avatar_url: motherData.avatarUrl || null,
          gender: 'female',
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Ona qo'shildi!",
        description: `${motherData.name} ona sifatida qo'shildi`,
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

  return {
    members,
    invitations,
    isLoading,
    networkUsers,
    addMember,
    addSpouseToMember,
    addChildToMember,
    addFatherToMember,
    addMotherToMember,
    countSpousesForMember,
    countChildrenForMember,
    countFathersForMember,
    countMothersForMember,
    sendInvitation,
    respondToInvitation,
    linkExistingMemberToUser,
    deleteMember,
    refetch: fetchMembers,
    refetchInvitations: fetchInvitations,
  };
};
