import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hkzmitfopfmxdmkksbnu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhrem1pdGZvcGZteGRta2tzYm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNDg4NTcsImV4cCI6MjA2NDkyNDg1N30.iFpErj7gFiK3pLYlx8lptJCmuzEhClM1-ECWYuw9sB0';

export const supabase = createClient(supabaseUrl, supabaseKey);