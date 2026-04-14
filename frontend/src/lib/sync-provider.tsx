'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { QK, useCanvasConnected } from '@/lib/queries';

const API = process.env.NEXT_PUBLIC_API_URL;
const SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between auto-syncs
const LS_KEY = 'studium_last_sync';

interface SyncContextValue {
  syncing: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  syncing: false,
  triggerSync: async () => {},
});

export function useSyncCanvas() {
  return useContext(SyncContext);
}

// Inner component so it can use hooks that require QueryClientProvider to already be mounted.
function SyncController({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { data: connected } = useCanvasConnected();
  const syncingRef = useRef(false);
  const autoSyncedRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API}/api/canvas/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Sync failed');

      localStorage.setItem(LS_KEY, Date.now().toString());

      // Invalidate all caches so every page reflects fresh data.
      queryClient.invalidateQueries({ queryKey: QK.courses });
      queryClient.invalidateQueries({ queryKey: QK.allCourses });
      queryClient.invalidateQueries({ queryKey: QK.assignments });
      queryClient.invalidateQueries({ queryKey: QK.assignmentGroups });
      queryClient.invalidateQueries({ queryKey: ['canvas-status'] });

      toast.success('Canvas synced');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [queryClient]);

  // Auto-sync once per session if data is stale (>30 min since last sync).
  useEffect(() => {
    if (!connected || autoSyncedRef.current) return;
    const lastSync = localStorage.getItem(LS_KEY);
    const isStale = !lastSync || Date.now() - parseInt(lastSync) > SYNC_COOLDOWN_MS;
    if (isStale) {
      autoSyncedRef.current = true;
      triggerSync();
    }
  }, [connected, triggerSync]);

  return (
    <SyncContext.Provider value={{ syncing, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

// Exported wrapper — place this inside QueryClientProvider.
export function SyncProvider({ children }: { children: React.ReactNode }) {
  return <SyncController>{children}</SyncController>;
}
