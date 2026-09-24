import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Estos datos te los dará Supabase cuando crees tu proyecto en su web
const supabaseUrl = 'https://zjpsvtufseqbpfavepap.supabase.co';
const supabaseAnonKey = 'sb_publishable_XU2l9g-EZf9qNN3AI_gBQQ_FGVJu2n_';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});