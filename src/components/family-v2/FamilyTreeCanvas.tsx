import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FamilyMemberNode from './FamilyMemberNode';
import { CoupleEdge } from './CoupleEdge';
import { FamilyMember } from '@/types/family';

interface FamilyTreeCanvasProps {
  members: Record<string, FamilyMember>;
  onOpenProfile: (member: FamilyMember) => void;
}

const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNode as any,
};

const edgeTypes: EdgeTypes = {
  couple: CoupleEdge as any,
};

export const FamilyTreeCanvas = ({
  members,
  onOpenProfile,
}: FamilyTreeCanvasProps) => {
  const calculateLayout = useCallback(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const processedCouples = new Set<string>();
    const nodePositions = new Map<string, { x: number; y: number }>();
    
    const HORIZONTAL_GAP = 220;
    const VERTICAL_GAP = 220;
    const SPOUSE_GAP = 160;
    
    // Get generation for each member
    const getGeneration = (memberId: string, visited = new Set<string>()): number => {
      if (visited.has(memberId)) return 0;
      visited.add(memberId);
      
      const member = members[memberId];
      if (!member) return 0;
      
      if (!member.parentIds || member.parentIds.length === 0) {
        return 0;
      }
      
      const parentGen = Math.max(
        ...member.parentIds.map(pid => getGeneration(pid, visited))
      );
      return parentGen + 1;
    };
    
    // Group members by generation
    const generations = new Map<number, FamilyMember[]>();
    Object.values(members).forEach(member => {
      const gen = getGeneration(member.id);
      if (!generations.has(gen)) {
        generations.set(gen, []);
      }
      generations.get(gen)!.push(member);
    });
    
    // Position nodes by generation
    const sortedGens = Array.from(generations.keys()).sort((a, b) => a - b);
    
    sortedGens.forEach((gen) => {
      const genMembers = generations.get(gen)!;
      let xOffset = 0;
      
      // Group by couples
      const couples: FamilyMember[][] = [];
      const singles: FamilyMember[] = [];
      const processed = new Set<string>();
      
      genMembers.forEach(member => {
        if (processed.has(member.id)) return;
        
        if (member.spouseId && members[member.spouseId]) {
          const spouse = members[member.spouseId];
          couples.push([member, spouse]);
          processed.add(member.id);
          processed.add(spouse.id);
        } else {
          singles.push(member);
          processed.add(member.id);
        }
      });
      
      // Calculate total width needed
      const totalItems = couples.length * 2 + singles.length;
      const startX = -(totalItems * HORIZONTAL_GAP) / 4;
      
      // Position couples
      couples.forEach(([member1, member2]) => {
        const coupleKey = [member1.id, member2.id].sort().join('-');
        if (!processedCouples.has(coupleKey)) {
          processedCouples.add(coupleKey);
          
          // Determine order (male left, female right)
          const [left, right] = member1.gender === 'male' 
            ? [member1, member2] 
            : [member2, member1];
          
          const leftX = startX + xOffset;
          const rightX = leftX + SPOUSE_GAP;
          const y = gen * VERTICAL_GAP;
          
          nodePositions.set(left.id, { x: leftX, y });
          nodePositions.set(right.id, { x: rightX, y });
          
          // Add spouse edge with heart
          edges.push({
            id: `spouse-${left.id}-${right.id}`,
            source: left.id,
            target: right.id,
            sourceHandle: 'spouse-right',
            targetHandle: 'spouse-left',
            type: 'couple',
          });
          
          xOffset += HORIZONTAL_GAP * 1.8;
        }
      });
      
      // Position singles
      singles.forEach(member => {
        const x = startX + xOffset;
        const y = gen * VERTICAL_GAP;
        nodePositions.set(member.id, { x, y });
        xOffset += HORIZONTAL_GAP;
      });
    });
    
    // Create nodes
    Object.values(members).forEach(member => {
      const pos = nodePositions.get(member.id) || { x: 0, y: 0 };
      
      nodes.push({
        id: member.id,
        type: 'familyMember',
        position: pos,
        data: {
          member,
          onOpenProfile,
        },
      });
    });
    
    // Create parent-child edges
    Object.values(members).forEach(member => {
      if (member.parentIds && member.parentIds.length > 0) {
        // Find the father (or first parent) for the edge
        const father = member.parentIds.find(pid => members[pid]?.gender === 'male');
        const parentId = father || member.parentIds[0];
        
        if (parentId && members[parentId]) {
          edges.push({
            id: `child-${parentId}-${member.id}`,
            source: parentId,
            target: member.id,
            type: 'smoothstep',
            style: { 
              stroke: 'hsl(210, 60%, 50%)', 
              strokeWidth: 2,
            },
            animated: false,
          });
        }
      }
    });
    
    return { nodes, edges };
  }, [members, onOpenProfile]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => calculateLayout(),
    [calculateLayout]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [members, calculateLayout, setNodes, setEdges]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-border bg-card/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
        className="bg-background"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
        <Controls 
          showInteractive={false}
          className="!bg-card !border-border !rounded-xl !shadow-md"
        />
      </ReactFlow>
    </div>
  );
};
