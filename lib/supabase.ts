import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
