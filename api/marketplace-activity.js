// api/marketplace-activity.js
// GET  — public endpoint, returns published items with public-safe fields only
// POST — admin-only actions (create, update, approve, publish, suppress, auto_draft)
//        requires X-Admin-Secret header for all write operations

const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Columns returned to public — NEVER expose related_*_email, title, suppression_reason
const PUBLIC_COLS = 'id,activity_type,public_summary,sector,region,role_level,visibility_locations,published_at';
const PUBLIC_LIMIT = 5;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── PUBLIC GET ─────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const location = req.query.location || 'landing'; // landing | candidate | recruiter
    const limit    = Math.min(parseInt(req.query.limit || PUBLIC_LIMIT, 10), 20);

    const { data, error } = await db
      .from('fed_marketplace_activity')
      .select(PUBLIC_COLS)
      .eq('status', 'published')
      .eq('suppressed', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .contains('visibility_locations', [location]) // must include this location
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('activity GET error:', error);
      return res.status(500).json({ error: 'Failed to load activity.' });
    }

    return res.status(200).json({ items: data || [], location, total: data?.length || 0 });
  }

  // ── ADMIN POST — all write operations ─────────────────────────────────────
  if (req.method === 'POST') {
    const adminSecret = req.headers['x-admin-secret'] || '';
    if (!process.env.ADMIN_PASSWORD || adminSecret !== process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Admin authentication required.' });
    }

    const { action, ...payload } = req.body || {};

    try {

      // ── GET ALL (admin sees all fields and statuses) ────────────────────────
      if (action === 'get_all') {
        const { data } = await db
          .from('fed_marketplace_activity')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        return res.status(200).json({ items: data || [] });
      }

      // ── CREATE (admin manually creates an item) ─────────────────────────────
      if (action === 'create') {
        const { activity_type, title, public_summary, sector, region, role_level,
                visibility_locations, expires_at } = payload;

        if (!activity_type || !public_summary) {
          return res.status(400).json({ error: 'activity_type and public_summary required.' });
        }

        const { data, error } = await db
          .from('fed_marketplace_activity')
          .insert({
            activity_type,
            title: title || null,
            public_summary,
            sector:   sector || null,
            region:   region || null,
            role_level: role_level || null,
            visibility_locations: visibility_locations || ['landing','candidate','recruiter'],
            expires_at: expires_at || null,
            status: 'draft',
            auto_generated: false,
          })
          .select('id')
          .single();

        if (error) throw error;
        return res.status(200).json({ ok: true, id: data.id });
      }

      // ── UPDATE (edit any field) ─────────────────────────────────────────────
      if (action === 'update') {
        const { id, ...fields } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });

        // Strip private-ish fields that should only be set by specific actions
        delete fields.approved_by;
        delete fields.approved_at;
        delete fields.published_at;
        delete fields.status; // status only via approve/publish/archive actions

        const { error } = await db.from('fed_marketplace_activity').update(fields).eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      // ── APPROVE (draft → approved) ──────────────────────────────────────────
      if (action === 'approve') {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });

        const { error } = await db.from('fed_marketplace_activity').update({
          status:      'approved',
          approved_by: 'admin',
          approved_at: new Date().toISOString(),
        }).eq('id', id).in('status', ['draft']);

        if (error) throw error;
        return res.status(200).json({ ok: true, status: 'approved' });
      }

      // ── PUBLISH (approved → published) ─────────────────────────────────────
      if (action === 'publish') {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });

        const { data: item } = await db.from('fed_marketplace_activity').select('status,public_summary').eq('id', id).single();
        if (!item) return res.status(404).json({ error: 'Not found.' });
        if (item.status === 'archived') return res.status(409).json({ error: 'Cannot publish archived item. Create a new one.' });

        const { error } = await db.from('fed_marketplace_activity').update({
          status:       'published',
          published_at: new Date().toISOString(),
          suppressed:   false,
          approved_by:  item.status === 'draft' ? 'admin' : undefined,
          approved_at:  item.status === 'draft' ? new Date().toISOString() : undefined,
        }).eq('id', id);

        if (error) throw error;
        return res.status(200).json({ ok: true, status: 'published' });
      }

      // ── SUPPRESS (hide without archiving — fast kill switch) ───────────────
      if (action === 'suppress') {
        const { id, reason } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });

        const { error } = await db.from('fed_marketplace_activity').update({
          suppressed:         true,
          suppression_reason: reason || 'Admin suppressed',
        }).eq('id', id);

        if (error) throw error;
        return res.status(200).json({ ok: true, suppressed: true });
      }

      // ── UNSUPPRESS ─────────────────────────────────────────────────────────
      if (action === 'unsuppress') {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });
        await db.from('fed_marketplace_activity').update({ suppressed: false, suppression_reason: null }).eq('id', id);
        return res.status(200).json({ ok: true, suppressed: false });
      }

      // ── ARCHIVE ────────────────────────────────────────────────────────────
      if (action === 'archive') {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'id required.' });
        await db.from('fed_marketplace_activity').update({ status: 'archived' }).eq('id', id);
        return res.status(200).json({ ok: true, status: 'archived' });
      }

      // ── AUTO_DRAFT — called from admin placement approval ──────────────────
      // Creates a draft activity item from a real placement/job record.
      // Never publishes automatically. Admin must review before publishing.
      if (action === 'auto_draft') {
        const { related_placement_id, related_job_id, related_recruiter_email,
                related_candidate_email, sector, region, role_level, activity_type } = payload;

        if (!related_placement_id) return res.status(400).json({ error: 'related_placement_id required.' });

        // Check if a draft already exists for this placement
        const { data: existing } = await db
          .from('fed_marketplace_activity')
          .select('id')
          .eq('related_placement_id', related_placement_id)
          .maybeSingle();

        if (existing) return res.status(200).json({ ok: true, id: existing.id, duplicate: true });

        // Generate a conservative public summary (admin should edit before publishing)
        const levelStr   = role_level || 'Executive-level';
        const sectorStr  = sector || 'maritime and industrial logistics';
        const regionStr  = region ? `, ${region}` : '';
        const typeStr    = activity_type || 'placement_verified';

        const summaryMap = {
          placement_verified: `${levelStr} placement completed, ${sectorStr} sector${regionStr}.`,
          role_filled:        `${levelStr} role filled, ${sectorStr}${regionStr}.`,
        };
        const autoSummary = summaryMap[typeStr] || summaryMap.placement_verified;

        const { data, error } = await db
          .from('fed_marketplace_activity')
          .insert({
            activity_type:          typeStr,
            title:                  `Auto-draft — review before publishing`,
            public_summary:         autoSummary,
            sector:                 sector || null,
            region:                 region || null,
            role_level:             role_level || null,
            visibility_locations:   ['landing','candidate','recruiter'],
            status:                 'draft',
            auto_generated:         true,
            auto_source:            'placement_confirmed',
            related_placement_id:   related_placement_id || null,
            related_job_id:         related_job_id || null,
            related_recruiter_email: related_recruiter_email || null,
            related_candidate_email: related_candidate_email || null,
          })
          .select('id')
          .single();

        if (error) throw error;
        return res.status(200).json({ ok: true, id: data.id, auto_generated: true });
      }

      // ── FLAG_DISPUTED — called if a placement is disputed after publication ─
      if (action === 'flag_disputed') {
        const { related_placement_id } = payload;
        if (!related_placement_id) return res.status(400).json({ error: 'related_placement_id required.' });

        // Find and suppress/flag any published item linked to this placement
        const { data: items } = await db
          .from('fed_marketplace_activity')
          .select('id, status')
          .eq('related_placement_id', related_placement_id);

        for (const item of (items || [])) {
          if (item.status === 'published') {
            await db.from('fed_marketplace_activity').update({
              suppressed:         true,
              suppression_reason: 'Related placement disputed — pending admin review',
            }).eq('id', item.id);
          }
        }

        return res.status(200).json({ ok: true, flagged: (items || []).length });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch(e) {
      console.error('marketplace-activity error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
