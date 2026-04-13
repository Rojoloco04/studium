'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Signs out users who logged in without "stay signed in" if the browser
 * was closed (sessionStorage is cleared on browser close, localStorage is not).
 *
 * Flow:
 *  - Login without stay-signed-in: sets localStorage.studium_ephemeral + sessionStorage.studium_session_active
 *  - Browser close clears sessionStorage
 *  - On next load: ephemeral flag present but no session flag → sign out
 */
export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const ephemeral = localStorage.getItem('studium_ephemeral');
    const sessionActive = sessionStorage.getItem('studium_session_active');

    if (ephemeral && !sessionActive) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          supabase.auth.signOut().then(() => {
            router.push('/login');
          });
        } else {
          // No session anyway — clean up stale flag
          localStorage.removeItem('studium_ephemeral');
        }
      });
    }
  }, [router]);

  return null;
}
