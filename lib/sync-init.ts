// Initialize sync on app load
import { supabase } from './supabase';
import { useStore } from './store';

export async function initializeSync() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // User is logged in, sync from Supabase
      const { syncFromSupabase } = useStore.getState();
      await syncFromSupabase();
    }
    // If not logged in, app uses local storage (already loaded by Zustand persist)
  } catch (error) {
    console.error('Sync initialization error:', error);
    // Continue with local storage if sync fails
  }
}
