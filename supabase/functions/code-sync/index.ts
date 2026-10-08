import { withSupabase } from 'npm:@supabase/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-client-info, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const jsonObject = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length <= 100000 ? v : null

const spotRow = (s: any, actor = '') => ({
  id: String(s?.id || '').slice(0, 120),
  name: String(s?.name || '').trim().slice(0, 80),
  lat: num(s?.lat),
  lon: num(s?.lon),
  seed: s?.seed && typeof s.seed === 'object' ? s.seed : null,
  photo: typeof s?.photo === 'string' ? s.photo : null,
  created_by: String(s?.createdBy || actor || '').slice(0, 40) || null,
  updated_by: String(actor || s?.updatedBy || '').slice(0, 40) || null,
  updated_at: new Date().toISOString(),
})

const sessionRow = (s: any, actor = '') => ({
  id: String(s?.id || '').slice(0, 120),
  spot_id: String(s?.spotId || '').slice(0, 120),
  spot_name: String(s?.spotName || '').slice(0, 80) || null,
  score: Number(s?.score),
  size: String(s?.size || '').slice(0, 80) || null,
  comment: String(s?.comment || '').slice(0, 1200) || null,
  session_date: String(s?.date || '').slice(0, 40) || null,
  author: String(s?.registeredBy || s?.author || actor || '').slice(0, 40) || null,
  wave: num(s?.wave),
  wave_dir: num(s?.waveDir),
  period: num(s?.period),
  wind: num(s?.wind),
  wind_dir: num(s?.windDir),
  gust: num(s?.gust),
  energy: num(s?.energy),
  tide: num(s?.tide),
  forecast_ts: String(s?.ts || '').slice(0, 80) || null,
  forecast_metadata: jsonObject(s?.forecast),
  original_forecast: jsonObject(s?.originalForecast),
  manual_adjustments: jsonObject(s?.manualAdjustments),
})

const toSpot = (r: any) => ({
  id: r.id, name: r.name, lat: r.lat, lon: r.lon, seed: r.seed, photo: r.photo,
  createdBy: r.created_by || '', updatedBy: r.updated_by || '', updatedAt: r.updated_at,
})

const toSession = (r: any) => ({
  id: r.id, spotId: r.spot_id, spotName: r.spot_name || '', score: r.score,
  size: r.size || '', comment: r.comment || '', date: r.session_date || '', registeredBy: r.author || '',
  wave: r.wave, waveDir: r.wave_dir, period: r.period, wind: r.wind, windDir: r.wind_dir,
  gust: r.gust, energy: r.energy, tide: r.tide, ts: r.forecast_ts,
  forecast: r.forecast_metadata || null, originalForecast: r.original_forecast || null,
  manualAdjustments: r.manual_adjustments || null,
})

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return ok({ error: 'method_not_allowed' }, 405)

    let body: any
    try { body = await req.json() } catch { return ok({ error: 'invalid_json' }, 400) }
    if (String(body?.pin || '') !== '7777') return ok({ error: 'invalid_pin' }, 401)

    const action = String(body?.action || 'login')
    const actor = String(body?.actor || '').trim().slice(0, 40)
    const db = ctx.supabaseAdmin

    if (action === 'login') return ok({ ok: true })

    if (action === 'snapshot') {
      const [{ data: spots, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
        db.from('code_spots').select('*').order('created_at', { ascending: true }),
        db.from('code_sessions').select('*').order('created_at', { ascending: true }),
      ])
      if (e1 || e2) return ok({ error: (e1 || e2)?.message || 'database_error' }, 500)
      return ok({ spots: (spots || []).map(toSpot), sessions: (sessions || []).map(toSession) })
    }

    if (action === 'upsert_spot') {
      const row = spotRow(body?.spot, actor)
      if (!row.id || !row.name) return ok({ error: 'invalid_spot' }, 400)
      const { data, error } = await db.from('code_spots').upsert(row, { onConflict: 'id' }).select('*').single()
      if (error) return ok({ error: error.message }, 500)
      return ok({ spot: toSpot(data) })
    }

    if (action === 'delete_spot') {
      const id = String(body?.spotId || '')
      if (!id) return ok({ error: 'invalid_spot' }, 400)
      const { error } = await db.from('code_spots').delete().eq('id', id)
      if (error) return ok({ error: error.message }, 500)
      return ok({ ok: true })
    }

    if (action === 'add_session') {
      const row = sessionRow(body?.session, actor)
      if (!row.id || !row.spot_id || !Number.isFinite(row.score)) return ok({ error: 'invalid_session' }, 400)
      const { data, error } = await db.from('code_sessions').upsert(row, { onConflict: 'id' }).select('*').single()
      if (error) return ok({ error: error.message }, 500)
      return ok({ session: toSession(data) })
    }

    if (action === 'migrate') {
      const spots = Array.isArray(body?.spots) ? body.spots.map((x: any) => spotRow(x, actor)).filter((x: any) => x.id && x.name) : []
      if (spots.length) {
        const { error } = await db.from('code_spots').upsert(spots, { onConflict: 'id' })
        if (error) return ok({ error: error.message }, 500)
      }
      const sessions = Array.isArray(body?.sessions) ? body.sessions.map((x: any) => sessionRow(x, actor)).filter((x: any) => x.id && x.spot_id && Number.isFinite(x.score)) : []
      if (sessions.length) {
        const { error } = await db.from('code_sessions').upsert(sessions, { onConflict: 'id' })
        if (error) return ok({ error: error.message }, 500)
      }
      return ok({ ok: true, spots: spots.length, sessions: sessions.length })
    }

    return ok({ error: 'unknown_action' }, 400)
  }),
}
