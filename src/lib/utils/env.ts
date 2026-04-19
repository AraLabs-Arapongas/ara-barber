export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.length === 0) {
    throw new Error(`Missing env var ${name}`)
  }
  return value
}

export const env = {
  supabaseUrl: () => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: () => requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: () => requireEnv('SUPABASE_SECRET_KEY'),
  appBaseHost: () => requireEnv('NEXT_PUBLIC_APP_BASE_HOST'),
  devBaseHost: () => requireEnv('NEXT_PUBLIC_DEV_BASE_HOST'),
}
