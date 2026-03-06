const fallbackProjectId = "ezsfzliblqsslqcnwdya";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6c2Z6bGlibHFzc2xxY253ZHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDUyMjcsImV4cCI6MjA4ODMyMTIyN30.vNfUQQ-D1FAjUvTksCSaLp0iybvef7P6aGJiE5z1SPw";

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

function getProjectIdFromUrl(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host.endsWith(".supabase.co")) return "";
    const [ref] = host.split(".");
    return ref || "";
  } catch {
    return "";
  }
}

export const projectId = getProjectIdFromUrl(envSupabaseUrl) || fallbackProjectId;
export const publicAnonKey = envAnonKey || fallbackAnonKey;
