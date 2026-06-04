import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';

interface DependencyGraphProps {
  dependencies: { source: string; target: string }[];
  className?: string;
}

export function DependencyGraph({ dependencies, className }: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodesSet = new Set<string>();
    const edges: Edge[] = [];

    dependencies.forEach((edge) => {
      nodesSet.add(edge.source);
      nodesSet.add(edge.target);
      edges.push({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: true,
      });
    });

    const nodes: Node[] = Array.from(nodesSet).map((nodeId, index) => ({
      id: nodeId,
      data: { label: nodeId },
      position: { x: Math.random() * 800, y: Math.random() * 600 },
      className: cn(
        'px-2 py-1 text-xs rounded-md border bg-card text-foreground',
        'border-border shadow-sm'
      ),
    }));

    return { nodes, edges };
  }, [dependencies]);

  // Note: Simple random positioning for now. A real layout engine like d3-force or dagre would be better.
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={cn('h-[500px] w-full rounded-lg border border-border bg-slate-50 dark:bg-slate-900', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
