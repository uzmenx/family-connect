import { BaseEdge, EdgeProps, useReactFlow } from '@xyflow/react';

export const ChildEdge = ({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) => {
  const { getNode } = useReactFlow();
  
  // Get spouse position to calculate center
  let centerX = sourceX;
  const centerY = sourceY;
  
  const edgeData = data as { spouseId?: string } | undefined;
  
  if (edgeData?.spouseId) {
    const spouseNode = getNode(edgeData.spouseId);
    if (spouseNode) {
      // Calculate center between parent and spouse (where heart is)
      const spouseX = spouseNode.position.x + 40; // Half of node width (80px)
      centerX = (sourceX + spouseX) / 2;
    }
  }
  
  // Create smooth bezier path from couple center to child
  // Control points for elegant curve
  const midY = (centerY + targetY) / 2;
  
  // Smooth S-curve path
  const path = `
    M ${centerX} ${centerY + 45}
    C ${centerX} ${midY},
      ${targetX} ${midY},
      ${targetX} ${targetY - 50}
  `;

  return (
    <>
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 80%, 65%)" />
          <stop offset="100%" stopColor="hsl(200, 80%, 45%)" />
        </linearGradient>
      </defs>
      <BaseEdge 
        id={id} 
        path={path}
        style={{
          stroke: `url(#gradient-${id})`,
          strokeWidth: 2.5,
          strokeLinecap: 'round',
          fill: 'none',
        }} 
      />
    </>
  );
};
