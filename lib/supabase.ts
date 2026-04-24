import { createClient } from "@supabase/supabase-js";
import { requiredSupabaseAnonKey, requiredSupabaseUrl } from "./env";

export const supabase = createClient(requiredSupabaseUrl, requiredSupabaseAnonKey);
