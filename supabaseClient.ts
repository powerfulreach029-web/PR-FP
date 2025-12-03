import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbtnhmgjtwnhbzgicwhe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidG5obWdqdHduaGJ6Z2ljd2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjI1MjksImV4cCI6MjA4MDIzODUyOX0.V4MCO1jueUGz1mexfGKWIBuRhtPcqwgfMJvLI7D_n7E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);