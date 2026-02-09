import { supabase } from '@/integrations/supabase/client';

/**
 * TOZA BIRLASHTIRISH ALGORITMI
 * 
 * Jarayon:
 * 1. Taklif qabul qilinadi → receiver profilini placeholder ga bog'laymiz
 * 2. Ota-onalarni avtomatik birlashtiramiz (jinsi va munosabat bo'yicha)
 * 3. Farzandlarni tavsiya qilamiz (ism o'xshashligi va jinsi bo'yicha)
 * 4. Foydalanuvchi tasdiqlaydi
 * 
 * Qoida: merged_into maydonidan foydalanamiz, relation_type ni O'ZGARTIRMAYMIZ!
 */

// ============= TYPES =============

export interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourcePhotoUrl?: string;
  targetPhotoUrl?: string;
  relationship: 'parent' | 'grandparent';
}

export interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

export interface ChildMergeSuggestion {
  sourceChild: ChildProfile;
  targetChild: ChildProfile;
  similarity: number;
}

export interface MergeResult {
  parentMerges: MergeCandidate[];
  childSuggestions: ChildMergeSuggestion[];
  allSourceChildren: ChildProfile[];
  allTargetChildren: ChildProfile[];
}

interface TreeMember {
  id: string;
  owner_id: string;
  member_name: string;
  gender: string | null;
  relation_type: string;
  linked_user_id: string | null;
  avatar_url: string | null;
  created_at: string;
  merged_into: string | null;
}

// ============= HELPER FUNCTIONS =============

/**
 * Ism o'xshashligini hisoblash (0-100)
 */
const calculateSimilarity = (name1: string, name2: string): number => {
  if (!name1 || !name2) return 0;
  
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  if (n1 === n2) return 100;
  if (n1.includes(n2) || n2.includes(n1)) return 80;
  if (n1.length >= 3 && n2.length >= 3 && n1.slice(0, 3) === n2.slice(0, 3)) return 60;
  
  // Oddiy harf mosligini hisoblash
  const maxLen = Math.max(n1.length, n2.length);
  let matches = 0;
  for (let i = 0; i < Math.min(n1.length, n2.length); i++) {
    if (n1[i] === n2[i]) matches++;
  }
  
  return Math.round((matches / maxLen) * 100);
};

/**
 * Member ning ota-onalarini topish
 */
const findParents = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const parents: TreeMember[] = [];
  const relType = member.relation_type || '';
  
  // child_of_X formatidagi ota-onalarni topish
  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    const parentId = childMatch[1];
    const parent = allMembers.find(m => m.id === parentId);
    if (parent) {
      parents.push(parent);
      // Juftini ham topish
      const spouse = allMembers.find(m => 
        m.relation_type === `spouse_of_${parentId}` || 
        parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouse) parents.push(spouse);
    }
  }
  
  // father_of_X / mother_of_X formatidagi ota-onalarni topish
  allMembers.forEach(m => {
    if (m.relation_type === `father_of_${member.id}` || 
        m.relation_type === `mother_of_${member.id}`) {
      if (!parents.find(p => p.id === m.id)) {
        parents.push(m);
      }
    }
  });
  
  return parents;
};

/**
 * Member ning farzandlarini topish
 */
const findChildren = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const children: TreeMember[] = [];
  const relType = member.relation_type || '';
  
  // father_of_X / mother_of_X formatidagi farzandlarni topish
  if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
    const childId = relType.replace('father_of_', '').replace('mother_of_', '');
    const child = allMembers.find(m => m.id === childId);
    if (child) children.push(child);
  }
  
  // child_of_X formatidagi farzandlarni topish
  allMembers.forEach(m => {
    if (m.relation_type.includes(`child_of_${member.id}`)) {
      if (!children.find(c => c.id === m.id)) {
        children.push(m);
      }
    }
  });
  
  // Juftning farzandlarini ham topish
  const spouseMatch = relType.match(/spouse_of_([a-f0-9-]+)/);
  if (spouseMatch) {
    const spouseId = spouseMatch[1];
    allMembers.forEach(m => {
      if (m.relation_type.includes(`child_of_${spouseId}`)) {
        if (!children.find(c => c.id === m.id)) {
          children.push(m);
        }
      }
    });
  }
  
  return children;
};

// ============= MAIN HOOK =============

export const useTreeMerging = () => {
  
  /**
   * Birlashtirish kandidatlarini topish
   * senderId - taklif yuboruvchi
   * receiverId - taklif qabul qiluvchi
   * linkedMemberId - receiver biriktirilgan placeholder ID
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string
  ): Promise<MergeResult> => {
    const result: MergeResult = {
      parentMerges: [],
      childSuggestions: [],
      allSourceChildren: [],
      allTargetChildren: [],
    };
    
    try {
      // Har ikkala foydalanuvchining daraxtlarini olish
      const [senderRes, receiverRes] = await Promise.all([
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', senderId)
          .is('merged_into', null),
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', receiverId)
          .is('merged_into', null)
      ]);
      
      // Eski merged_into_ format bilan yozuvlarni filtrlash
      const senderMembers = ((senderRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      const receiverMembers = ((receiverRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      
      if (!senderMembers.length || !receiverMembers.length) return result;
      
      // Linked member va receiver o'zini topish
      const linkedMember = senderMembers.find(m => m.id === linkedMemberId);
      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      
      if (!linkedMember || !receiverSelf) return result;
      
      // Ota-onalarni topish
      const senderParents = findParents(linkedMember, senderMembers);
      const receiverParents = findParents(receiverSelf, receiverMembers);
      
      // Ota-onalarni jinsi bo'yicha moslashtirish
      for (const senderParent of senderParents) {
        const matchingReceiverParent = receiverParents.find(
          rp => rp.gender === senderParent.gender
        );
        
        if (matchingReceiverParent) {
          // Eski yaratilgan profilni asosiy qilib olish
          const senderDate = new Date(senderParent.created_at);
          const receiverDate = new Date(matchingReceiverParent.created_at);
          
          const [sourceParent, targetParent] = senderDate <= receiverDate 
            ? [senderParent, matchingReceiverParent]
            : [matchingReceiverParent, senderParent];
          
          result.parentMerges.push({
            sourceId: sourceParent.id,
            targetId: targetParent.id,
            sourceName: sourceParent.member_name || 'Ism kiritilmagan',
            targetName: targetParent.member_name || 'Ism kiritilmagan',
            sourcePhotoUrl: sourceParent.avatar_url || undefined,
            targetPhotoUrl: targetParent.avatar_url || undefined,
            relationship: 'parent',
          });
          
          // Bobo-buvilarni ham birlashtirish
          const senderGrandparents = findParents(senderParent, senderMembers);
          const receiverGrandparents = findParents(matchingReceiverParent, receiverMembers);
          
          for (const sgp of senderGrandparents) {
            const matchingRgp = receiverGrandparents.find(rgp => rgp.gender === sgp.gender);
            if (matchingRgp) {
              const sDate = new Date(sgp.created_at);
              const rDate = new Date(matchingRgp.created_at);
              
              const [sourceGp, targetGp] = sDate <= rDate ? [sgp, matchingRgp] : [matchingRgp, sgp];
              
              result.parentMerges.push({
                sourceId: sourceGp.id,
                targetId: targetGp.id,
                sourceName: sourceGp.member_name || 'Ism kiritilmagan',
                targetName: targetGp.member_name || 'Ism kiritilmagan',
                sourcePhotoUrl: sourceGp.avatar_url || undefined,
                targetPhotoUrl: targetGp.avatar_url || undefined,
                relationship: 'grandparent',
              });
            }
          }
          
          // Farzandlarni (aka-uka-singillar) topish
          const senderSiblings = findChildren(senderParent, senderMembers)
            .filter(c => c.id !== linkedMemberId);
          const receiverSiblings = findChildren(matchingReceiverParent, receiverMembers)
            .filter(c => c.id !== receiverSelf.id);
          
          // Source (sender tomonidagi farzandlar)
          result.allSourceChildren = senderSiblings.map(c => ({
            id: c.id,
            name: c.member_name || 'Ism kiritilmagan',
            photoUrl: c.avatar_url || undefined,
            gender: (c.gender as 'male' | 'female') || 'male',
          }));
          
          // Target (receiver tomonidagi farzandlar)
          result.allTargetChildren = receiverSiblings.map(c => ({
            id: c.id,
            name: c.member_name || 'Ism kiritilmagan',
            photoUrl: c.avatar_url || undefined,
            gender: (c.gender as 'male' | 'female') || 'male',
          }));
          
          // Tavsiyalarni yaratish (jinsi va ism o'xshashligi bo'yicha)
          const usedTargetIds = new Set<string>();
          
          for (const sourceChild of result.allSourceChildren) {
            const availableTargets = result.allTargetChildren.filter(
              t => t.gender === sourceChild.gender && !usedTargetIds.has(t.id)
            );
            
            if (availableTargets.length === 0) continue;
            
            // Eng yaxshi moslikni topish
            const scored = availableTargets.map(target => ({
              target,
              similarity: calculateSimilarity(sourceChild.name, target.name),
            }));
            scored.sort((a, b) => b.similarity - a.similarity);
            
            const best = scored[0];
            if (best && best.similarity >= 30) {
              result.childSuggestions.push({
                sourceChild,
                targetChild: best.target,
                similarity: best.similarity,
              });
              usedTargetIds.add(best.target.id);
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('findMergeCandidates error:', error);
      return result;
    }
  };
  
  /**
   * Ota-onalarni avtomatik birlashtirish
   * MUHIM: relation_type ni O'ZGARTIRMAYMIZ - faqat merged_into maydonidan foydalanamiz!
   */
  const executeParentMerge = async (merges: MergeCandidate[]): Promise<boolean> => {
    try {
      for (const merge of merges) {
        // Source profilga ma'lumotlarni qo'shish (agar kerak bo'lsa)
        const [sourceRes, targetRes] = await Promise.all([
          supabase.from('family_tree_members').select('*').eq('id', merge.sourceId).single(),
          supabase.from('family_tree_members').select('*').eq('id', merge.targetId).single()
        ]);
        
        const source = sourceRes.data as TreeMember | null;
        const target = targetRes.data as TreeMember | null;
        
        if (!source || !target) continue;
        
        // Target dagi ma'lumotlarni source ga ko'chirish
        const updates: Record<string, unknown> = {};
        
        if (target.linked_user_id && !source.linked_user_id) {
          updates.linked_user_id = target.linked_user_id;
          updates.is_placeholder = false;
        }
        if (!source.member_name && target.member_name) {
          updates.member_name = target.member_name;
        }
        if (!source.avatar_url && target.avatar_url) {
          updates.avatar_url = target.avatar_url;
        }
        
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('family_tree_members')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', merge.sourceId);
        }
        
        // Target ni merged sifatida belgilash (relation_type O'ZGARTIRILMAYDI!)
        await supabase
          .from('family_tree_members')
          .update({ 
            merged_into: merge.sourceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', merge.targetId);
        
        console.log(`Merged: ${merge.sourceName} ← ${merge.targetName}`);
      }
      
      return true;
    } catch (error) {
      console.error('executeParentMerge error:', error);
      return false;
    }
  };
  
  /**
   * Farzandlarni birlashtirish
   */
  const executeChildMerge = async (
    sourceId: string, 
    targetId: string
  ): Promise<boolean> => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('id', sourceId).single(),
        supabase.from('family_tree_members').select('*').eq('id', targetId).single()
      ]);
      
      const source = sourceRes.data as TreeMember | null;
      const target = targetRes.data as TreeMember | null;
      
      if (!source || !target) return false;
      
      // Target dagi ma'lumotlarni source ga ko'chirish
      const updates: Record<string, unknown> = {};
      
      if (target.linked_user_id && !source.linked_user_id) {
        updates.linked_user_id = target.linked_user_id;
        updates.is_placeholder = false;
      }
      if (!source.member_name && target.member_name) {
        updates.member_name = target.member_name;
      }
      if (!source.avatar_url && target.avatar_url) {
        updates.avatar_url = target.avatar_url;
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('family_tree_members')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', sourceId);
      }
      
      // Target ni merged sifatida belgilash
      await supabase
        .from('family_tree_members')
        .update({ 
          merged_into: sourceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);
      
      return true;
    } catch (error) {
      console.error('executeChildMerge error:', error);
      return false;
    }
  };
  
  return {
    findMergeCandidates,
    executeParentMerge,
    executeChildMerge,
    calculateSimilarity,
  };
};
