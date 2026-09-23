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

    const { analysisId } = await req.json();
    if (!analysisId) return jsonResponse({ error: 'analysisId required' }, 400);

    const admin = adminClient();
    const { data: analysis, error } = await admin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();
    if (error || !analysis) return jsonResponse({ error: 'Not found' }, 404);
    if (analysis.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403);

    // Verify object exists
    if (!analysis.storage_path) {
      return jsonResponse({ error: 'No storage path' }, 400);
    }

    await admin
      .from('analyses')
      .update({ status: 'uploaded' })
      .eq('id', analysisId)
      .eq('user_id', user.id);

    await admin
      .from('analyses')
      .update({ status: 'queued' })
      .eq('id', analysisId);

    // Fire-and-forget process worker (async — do not await long Gemini work here)
    const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-analysis`;
    fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ analysisId }),
    }).catch((err) => console.error('Failed to invoke process-analysis', err));

    return jsonResponse({ ok: true, analysisId, status: 'queued' });
  } catch (e) {
    console.error('enqueue-analysis', e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});
