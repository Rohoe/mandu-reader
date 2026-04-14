import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Stub client used when Supabase is not configured — prevents import-time crashes.
// Cloud sync methods (cloudSync.js) call getUser/signInWithOAuth/signOut but those
// paths are only triggered by explicit user action and guarded by try/catch.
const NO_SESSION = Promise.resolve({ data: { session: null } });
const NO_USER = Promise.resolve({ data: { user: null } });
const NOOP_SUB = { data: { subscription: { unsubscribe() {} } } };
const STUB = {
  auth: {
    getSession: () => NO_SESSION,
    getUser: () => NO_USER,
    onAuthStateChange: () => NOOP_SUB,
    signInWithOAuth: () => Promise.reject(new Error('Supabase not configured')),
    signOut: () => Promise.resolve(),
  },
  from: () => ({ select: () => Promise.resolve({ data: [], error: null }), upsert: () => Promise.resolve({ error: 'Supabase not configured' }) }),
};

export const supabase = url && key ? createClient(url, key) : STUB;
