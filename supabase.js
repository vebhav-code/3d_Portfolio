import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'geaziypuwsucehkrcjup';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_U_rLovFCJpOfDFUxWobkJQ_CvsM1kOD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Measures real-time network latency to the Supabase backend.
 */
export async function measureSupabaseLatency() {
  const start = performance.now();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON_KEY }
    });
    return Math.round(performance.now() - start);
  } catch (e) {
    return null;
  }
}

/**
 * Sends a contact message to Supabase.
 */
export async function sendContactMessage({ name, email, message }) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([{ name, email, message, created_at: new Date().toISOString() }]);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches all contact messages from Supabase ordered by newest first.
 */
export async function fetchContactMessages() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message, data: [] };
    }
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Deletes a contact message by ID.
 */
export async function deleteContactMessage(id) {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
