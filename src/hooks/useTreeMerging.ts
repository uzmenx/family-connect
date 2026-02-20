import { supabase } from '@/integrations/supabase/client';

/**
 * TOZA BIRLASHTIRISH ALGORITMI
 * 
 * Jarayon:
 * 1. Taklif qabul qilinadi → receiver profilini placeholder ga bog'laymiz
 * 2. Ota-onalarni avtomatik birlashtiramiz (jinsi va munosabat bo'yicha)
 * 3. Farzandlarni juftlik (couple) bo'yicha guruhlash va tavsiya qilish
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

export interface CoupleGroup {
  label: string;
  parentMerges: MergeCandidate[];
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  childSuggestions: ChildMergeSuggestion[];
}

export interface MergeResult {
  parentMerges: MergeCandidate[];
  coupleGroups: CoupleGroup[];
  // backward compat
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
export const calculateSimilarity = (name1: string, name2: string): number => {
  if (!name1 || !name2) return 0;
  
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  if (n1 === n2) return 100;
  if (n1.includes(n2) || n2.includes(n1)) return 80;
  if (n1.length >= 3 && n2.length >= 3 && n1.slice(0, 3) === n2.slice(0, 3)) return 60;
  
  const maxLen = Math.max(n1.length, n2.length);
  let matches = 0;
  for (let i = 0; i < Math.min(n1.length, n2.length); i++) {
    if (n1[i] === n2[i]) matches++;
  }
  
  return Math.round((matches / maxLen) * 100);
};

/**
 * Farzandlar uchun tavsiyalarni hisoblash
 */
const computeChildSuggestions = (
  sourceChildren: ChildProfile[],
  targetChildren: ChildProfile[]
): ChildMergeSuggestion[] => {
  const suggestions: ChildMergeSuggestion[] = [];
  const usedTargetIds = new Set<string>();
  
  for (const sourceChild of sourceChildren) {
    const availableTargets = targetChildren.filter(
      t => t.gender === sourceChild.gender && !usedTargetIds.has(t.id)
    );
    
    if (availableTargets.length === 0) continue;
    
    const scored = availableTargets.map(target => ({
      target,
      similarity: calculateSimilarity(sourceChild.name, target.name),
    }));
    scored.sort((a, b) => b.similarity - a.similarity);
    
    const best = scored[0];
    if (best && best.similarity >= 30) {
      suggestions.push({
        sourceChild,
        targetChild: best.target,
        similarity: best.similarity,
      });
      usedTargetIds.add(best.target.id);
    }
  }
  
  return suggestions;
};

/**
 * Member ning ota-onalarini topish
 */
const findParents = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const parents: TreeMember[] = [];
  const relType = member.relation_type || '';
  
  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    const parentId = childMatch[1];
    const parent = allMembers.find(m => m.id === parentId);
    if (parent) {
      parents.push(parent);
      const spouse = allMembers.find(m => 
        m.relation_type === `spouse_of_${parentId}` || 
        parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouse) parents.push(spouse);
    }
  }
  
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
 * Member ning farzandlarini topish (unique)
 */
const findChildren = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const childrenMap = new Map<string, TreeMember>();
  const relType = member.relation_type || '';
  
  // father_of_X / mother_of_X
  if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
    const childId = relType.replace('father_of_', '').replace('mother_of_', '');
    const child = allMembers.find(m => m.id === childId);
    if (child) childrenMap.set(child.id, child);
  }
  
  // child_of_X
  allMembers.forEach(m => {
    if (m.relation_type.includes(`child_of_${member.id}`)) {
      childrenMap.set(m.id, m);
    }
  });
  
  // Spouse children
  const spouseMatch = relType.match(/spouse_of_([a-f0-9-]+)/);
  if (spouseMatch) {
    const spouseId = spouseMatch[1];
    allMembers.forEach(m => {
      if (m.relation_type.includes(`child_of_${spouseId}`)) {
        childrenMap.set(m.id, m);
      }
    });
  }
  
  return Array.from(childrenMap.values());
};

/**
 * Ikki ota-onaning barcha farzandlarini topish (combined, unique)
 */
const findCoupleChildren = (
  parents: TreeMember[],
  allMembers: TreeMember[],
  excludeIds: string[]
): TreeMember[] => {
  const childrenMap = new Map<string, TreeMember>();
  
  for (const parent of parents) {
    const children = findChildren(parent, allMembers);
    children.forEach(c => {
      if (!excludeIds.includes(c.id)) {
        childrenMap.set(c.id, c);
      }
    });
  }
  
  return Array.from(childrenMap.values());
};

const toChildProfile = (m: TreeMember): ChildProfile => ({
  id: m.id,
  name: m.member_name || 'Ism kiritilmagan',
  photoUrl: m.avatar_url || undefined,
  gender: (m.gender as 'male' | 'female') || 'male',
});

const createMergeEntry = (
  sp: TreeMember,
  rp: TreeMember,
  rel: 'parent' | 'grandparent'
): MergeCandidate => {
  const sDate = new Date(sp.created_at);
  const rDate = new Date(rp.created_at);
  const [source, target] = sDate <= rDate ? [sp, rp] : [rp, sp];
  return {
    sourceId: source.id,
    targetId: target.id,
    sourceName: source.member_name || 'Ism kiritilmagan',
    targetName: target.member_name || 'Ism kiritilmagan',
    sourcePhotoUrl: source.avatar_url || undefined,
    targetPhotoUrl: target.avatar_url || undefined,
    relationship: rel,
  };
};

// ============= MAIN HOOK =============

export const useTreeMerging = () => {
  
  /**
   * Birlashtirish kandidatlarini topish - juftlik (couple) bo'yicha guruhlangan
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string
  ): Promise<MergeResult> => {
    const result: MergeResult = {
      parentMerges: [],
      coupleGroups: [],
      childSuggestions: [],
      allSourceChildren: [],
      allTargetChildren: [],
    };
    
    try {
      const [senderRes, receiverRes] = await Promise.all([
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', senderId)
          .is('merged_into', null),
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', receiverId)
          .is('merged_into', null)
      ]);
      
      const senderMembers = ((senderRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      const receiverMembers = ((receiverRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      
      if (!senderMembers.length || !receiverMembers.length) return result;
      
      const linkedMember = senderMembers.find(m => m.id === linkedMemberId);
      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      
      if (!linkedMember || !receiverSelf) return result;
      
      // === OTA-ONALAR ===
      const senderParents = findParents(linkedMember, senderMembers);
      const receiverParents = findParents(receiverSelf, receiverMembers);
      
      const senderFather = senderParents.find(p => p.gender === 'male');
      const senderMother = senderParents.find(p => p.gender === 'female');
      const receiverFather = receiverParents.find(p => p.gender === 'male');
      const receiverMother = receiverParents.find(p => p.gender === 'female');
      
      // Parent couple merges
      const parentCoupleMerges: MergeCandidate[] = [];
      if (senderFather && receiverFather) {
        const merge = createMergeEntry(senderFather, receiverFather, 'parent');
        parentCoupleMerges.push(merge);
        result.parentMerges.push(merge);
      }
      if (senderMother && receiverMother) {
        const merge = createMergeEntry(senderMother, receiverMother, 'parent');
        parentCoupleMerges.push(merge);
        result.parentMerges.push(merge);
      }
      
      // Parent couple children (siblings of the linked member)
      if (parentCoupleMerges.length > 0) {
        const sChildren = findCoupleChildren(
          [senderFather, senderMother].filter(Boolean) as TreeMember[],
          senderMembers,
          [linkedMemberId]
        );
        const rChildren = findCoupleChildren(
          [receiverFather, receiverMother].filter(Boolean) as TreeMember[],
          receiverMembers,
          [receiverSelf.id]
        );
        
        const sourceChildren = sChildren.map(toChildProfile);
        const targetChildren = rChildren.map(toChildProfile);
        const childSuggestions = computeChildSuggestions(sourceChildren, targetChildren);
        
        result.allSourceChildren.push(...sourceChildren);
        result.allTargetChildren.push(...targetChildren);
        result.childSuggestions.push(...childSuggestions);
        
        if (sourceChildren.length > 0 || targetChildren.length > 0) {
          // Couple label: "Ota + Ona"
          const fatherName = (senderFather || receiverFather)?.member_name || '';
          const motherName = (senderMother || receiverMother)?.member_name || '';
          const label = [fatherName, motherName].filter(Boolean).join(' va ') || 'Ota-ona';
          
          result.coupleGroups.push({
            label,
            parentMerges: parentCoupleMerges,
            sourceChildren,
            targetChildren,
            childSuggestions,
          });
        }
      }
      
      // === BOBO-BUVILAR ===
      const processedPairs = new Set<string>();
      
      for (const sParent of [senderFather, senderMother].filter(Boolean) as TreeMember[]) {
        const matchingRParent = [receiverFather, receiverMother].find(
          r => r && r.gender === sParent.gender
        );
        if (!matchingRParent) continue;
        
        const sGrandparents = findParents(sParent, senderMembers);
        const rGrandparents = findParents(matchingRParent, receiverMembers);
        
        if (sGrandparents.length === 0 || rGrandparents.length === 0) continue;
        
        const grandCoupleMerges: MergeCandidate[] = [];
        
        for (const sgp of sGrandparents) {
          const matchingRgp = rGrandparents.find(rgp => rgp.gender === sgp.gender);
          if (!matchingRgp) continue;
          
          const pairKey = [sgp.id, matchingRgp.id].sort().join('-');
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);
          
          const merge = createMergeEntry(sgp, matchingRgp, 'grandparent');
          grandCoupleMerges.push(merge);
          result.parentMerges.push(merge);
        }
        
        if (grandCoupleMerges.length > 0) {
          // Find children of grandparents (aunts/uncles), excluding the parent itself
          const sGpChildren = findCoupleChildren(
            sGrandparents,
            senderMembers,
            [sParent.id]
          );
          const rGpChildren = findCoupleChildren(
            rGrandparents,
            receiverMembers,
            [matchingRParent.id]
          );
          
          const sourceChildren = sGpChildren.map(toChildProfile);
          const targetChildren = rGpChildren.map(toChildProfile);
          const childSuggestions = computeChildSuggestions(sourceChildren, targetChildren);
          
          result.allSourceChildren.push(...sourceChildren);
          result.allTargetChildren.push(...targetChildren);
          result.childSuggestions.push(...childSuggestions);
          
          if (sourceChildren.length > 0 || targetChildren.length > 0) {
            const gpFather = sGrandparents.find(g => g.gender === 'male');
            const gpMother = sGrandparents.find(g => g.gender === 'female');
            const label = [gpFather?.member_name, gpMother?.member_name]
              .filter(Boolean).join(' va ') || 'Bobo-buvi';
            
            result.coupleGroups.push({
              label,
              parentMerges: grandCoupleMerges,
              sourceChildren,
              targetChildren,
              childSuggestions,
            });
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
   */
  const executeParentMerge = async (merges: MergeCandidate[]): Promise<boolean> => {
    try {
      for (const merge of merges) {
        const [sourceRes, targetRes] = await Promise.all([
          supabase.from('family_tree_members').select('*').eq('id', merge.sourceId).single(),
          supabase.from('family_tree_members').select('*').eq('id', merge.targetId).single()
        ]);
        
        const source = sourceRes.data as TreeMember | null;
        const target = targetRes.data as TreeMember | null;
        
        if (!source || !target) continue;
        
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
