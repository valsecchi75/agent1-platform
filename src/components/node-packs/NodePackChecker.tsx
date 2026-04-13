'use client';

import { useEffect } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const LAST_SEEN_KEY = 'agent1-node-packs-lastSeen';

export function NodePackChecker() {
  const setActiveNodeTypes = useWorkflowStore((s) => s.setActiveNodeTypes);
  const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);

  useEffect(() => {
    // 1. Fetch active node types
    fetch('/api/node-registry/active-types')
      .then((res) => res.json())
      .then((data) => {
        if (data.nodeTypes) {
          setActiveNodeTypes(data.nodeTypes);
        }
      })
      .catch(() => {});

    // 2. Check registry for new packs
    fetch('/api/node-packs/registry')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.packs) return;

        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);

        const hasNew = data.packs.some((pack: { updatedAt: string }) => {
          return new Date(pack.updatedAt) > lastSeenDate;
        });

        if (hasNew) {
          setNodePackBadge(true);
        }

        localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      })
      .catch(() => {});
  }, [setActiveNodeTypes, setNodePackBadge]);

  return null;
}
