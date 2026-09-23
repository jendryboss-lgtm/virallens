import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userSb = userClient(authHeader);
    const {
      data: { user },
    } = await userSb.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = adminClient();

    // Remove storage objects under user folder
    const { data: objects } = await admin.storage.from('videos').list(user.id, { limit: 1000 });
    if (objects && objects.length > 0) {
      await admin.storage.from('videos').remove(objects.map((o) => `${user.id}/${o.name}`));
    }

    // Cascades via FKs for analyses/events/subscriptions/usage/profiles
    await admin.from('profiles').delete().eq('id', user.id);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('delete-user', e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
