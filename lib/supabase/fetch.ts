/** Map low-level Supabase/network errors to actionable messages. */
export function formatSupabaseError(message: string): string {
  if (message.includes('fetch failed') || message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
    if (process.env.NODE_ENV === 'development') {
      return 'Local SSL blocked Supabase. Add SUPABASE_INSECURE_SSL=true to .env and restart npm run dev.';
    }
    return 'Server cannot reach Supabase. Check SUPABASE_URL and network from your host.';
  }
  return message;
}

/** Dev-only: Windows often fails Supabase HTTPS cert verification locally. */
export function applyDevSupabaseTlsWorkaround(): void {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.SUPABASE_INSECURE_SSL === 'true'
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}
