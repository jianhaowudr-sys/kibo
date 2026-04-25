import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://cwxwobpleysfklgakllf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3eHdvYnBsZXlzZmtsZ2FrbGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjY0NDksImV4cCI6MjA5MjY0MjQ0OX0.U1CtpbGtSeE8zipEEaNoVh5gXOZixPGfKnyBrcYcaww';

export const isSupabaseConfigured = () =>
  !SUPABASE_URL.startsWith('__') && !SUPABASE_ANON_KEY.startsWith('__');

export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder',
  {
    auth: {
      storage: AsyncStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
