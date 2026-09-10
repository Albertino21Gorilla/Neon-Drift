const PROJECT_URL = 'https://pyxzktxzvoalyklpjgsm.supabase.co';
const PUBLIC_KEY = 'sb_publishable_Ak3J64sxAfnH9fjwHE0wjg_k0e_4WaA';
const RETURN_URL = 'https://albertinothecoder.github.io/Neon-Drift/neon-drift-online/';
const $ = id => document.getElementById(id);
let client;
let revision = 0;
function fail(message) { $('message').textContent = message; $('retry').hidden = false; }
async function refresh() {
  const current = ++revision;
  $('retry').hidden = true;
  $('account').hidden = true;
  $('login').hidden = true;
  $('message').textContent = 'Connecting…';
  const { data, error } = await client.auth.getUser();
  if (current !== revision) return;
  if (!data.user) {
    $('message').textContent = error && error.name !== 'AuthSessionMissingError'
      ? 'Your session could not be verified. Please sign in again.' : 'Sign in to meet your online pilot.';
    $('login').hidden = false;
    return;
  }
  $('account').hidden = false;
  $('pilot').textContent = data.user.user_metadata?.full_name || 'Pilot';
  $('points').textContent = '—'; $('energy').textContent = '—';
  const { data: profile, error: profileError } = await client.rpc('nd_my_profile');
  if (current !== revision) return;
  if (profileError) {
    fail('Signed in. Account data is unavailable: complete the Supabase database setup, then retry.');
    return;
  }
  $('points').textContent = Number(profile.points).toLocaleString();
  $('energy').textContent = Number(profile.energy).toLocaleString();
  $('message').textContent = 'Connected · Account loaded';
}
$('retry').onclick = () => location.reload();
try {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.4');
  client = createClient(PROJECT_URL, PUBLIC_KEY, { auth: {
    flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
    storageKey: 'neon-drift-online-auth'
  }});
  $('login').onclick = async () => {
    $('login').disabled = true;
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: RETURN_URL } });
      if (error) throw error;
    } catch { fail('Google sign-in could not start. Check your connection and try again.'); $('login').disabled = false; }
  };
  $('logout').onclick = async () => {
    $('logout').disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      await refresh();
    } catch { fail('Sign-out failed. Please retry.'); }
    finally { $('logout').disabled = false; }
  };
  client.auth.onAuthStateChange(() => { setTimeout(() => refresh().catch(() => fail('Connection lost. Please retry.')), 0); });
  await refresh();
} catch { fail('Could not connect. Check your internet connection and retry.'); }
