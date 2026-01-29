import { EdgeProps, useStore } from '@xyflow/react';

export const ChildEdge = ({
  id,
  source,
  target,
  data,
}: EdgeProps) => {
  // Subscribe to node changes to get real-time positions
  // All hooks must be called unconditionally at the top
  const sourceNode = useStore((state) => state.nodeLookup.get(source));
  const targetNode = useStore((state) => state.nodeLookup.get(target));
  
  const edgeData = data as { spouseId?: string } | undefined;
  const spouseId = edgeData?.spouseId;
  
  // Always call the hook, but only use the result if spouseId exists
  const spouseNode = useStore((state) => 
    spouseId ? state.nodeLookup.get(spouseId) : undefined
  );
  
  if (!sourceNode || !targetNode) return null;
  
  // Node dimensions
  const nodeWidth = 80;
  const nodeHeight = 80;
  
  // Calculate source center (parent node)
  const sourceX = sourceNode.position.x + nodeWidth / 2;
  const sourceY = sourceNode.position.y + nodeHeight; // Bottom of parent avatar
  
  // Calculate target position (child node)
  const targetX = targetNode.position.x + nodeWidth / 2;
  const targetY = targetNode.position.y - 5; // Top of child (slightly above for handle)
  
  // Calculate center point between couple (where heart is)
  let startX = sourceX;
  if (spouseNode) {
    const spouseX = spouseNode.position.x + nodeWidth / 2;
    startX = (sourceX + spouseX) / 2;
  }
  
  // Starting Y position - from the heart/couple connection level
  const startY = sourceY + 5; // Just below the bottom of parent
  
  // Create smooth bezier curve
  const deltaY = targetY - startY;
  
  // Control points for a beautiful S-curve
  const cp1X = startX;
  const cp1Y = startY + deltaY * 0.45;
  const cp2X = targetX;
  const cp2Y = startY + deltaY * 0.55;
  
  const path = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;

  return (
    <>
      <defs>
        <linearGradient id={`child-gradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(200, 85%, 65%)" stopOpacity="0.8" />
          <stop offset="50%" stopColor="hsl(200, 80%, 55%)" />
          <stop offset="100%" stopColor="hsl(200, 75%, 50%)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* Glow/shadow layer */}
      <path
        d={path}
        fill="none"
        stroke="hsl(200, 80%, 60%)"
        strokeWidth="5"
        strokeOpacity="0.25"
        strokeLinecap="round"
      />
      {/* Main line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#child-gradient-${id})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{
          filter: 'drop-shadow(0 0 3px hsl(200, 80%, 55% / 0.5))',
        }}
      />
    </>
  );
};
