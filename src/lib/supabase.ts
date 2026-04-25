import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kifomotfmgevnrgiujvr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZm9tb3RmbWdldm5yZ2l1anZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTQ2NjAsImV4cCI6MjA5MjE5MDY2MH0.8rcbTJEf_jRvR-ri-Lywi7tdvcxxDUE8SElewm5DoSk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);