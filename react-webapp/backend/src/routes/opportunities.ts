import { Router } from 'express';
import { db } from '../config/postgres.js';
import { requireAuth, type AuthRequest } from '../middlewear/auth.js';
import { geocode } from '../scrapers/geocoder.js';
import {
  sanitizeOptionalHttpsUrl,
  sanitizeStringArray,
  sanitizeText,
  toBoundedPositiveInt,
} from '../middlewear/security.js';
import { apiWriteRateLimiter } from '../middlewear/authRateLimit.js';

const router = Router();

/** GET /api/opportunities?type=all&limit=200 */
router.get('/', async (req, res) => {
  const typeRaw = sanitizeText(req.query.type, 30);
  const type = typeRaw || undefined;
  const limit = toBoundedPositiveInt(req.query.limit, 200, 1, 500);

  try {
    const { rows } = await db.query(
      `SELECT
         id::text,
         type,
         title,
         org,
         city,
         state,
         lat,
         lng,
         amount,
         stipend,
         deadline,
         match_pct  AS "matchPct",
         tags,
         description,
         url
       FROM opportunities
       WHERE ($1::text IS NULL OR type = $1)
         AND lat IS NOT NULL
         AND lng IS NOT NULL
       ORDER BY scraped_at DESC
       LIMIT $2`,
      [type && type !== 'all' ? type : null, limit],
    );

    res.json(rows);
  } catch (err) {
    console.error('[opportunities] query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', requireAuth, apiWriteRateLimiter, async (req: AuthRequest, res) => {
  const {
    type,
    title,
    org,
    city,
    state,
    lat,
    lng,
    amount,
    stipend,
    deadline,
    tags,
    description,
    url,
  } = req.body ?? {};

  const allowedTypes = new Set(['scholarship', 'internship', 'networking']);
  if (!allowedTypes.has(type)) {
    res.status(400).json({ error: 'Invalid opportunity type' });
    return;
  }

  const normalizedTitle = sanitizeText(title, 180);
  const normalizedOrg = sanitizeText(org, 160);
  const normalizedCity = sanitizeText(city, 120);
  const normalizedState = sanitizeText(state, 12).toUpperCase();
  const normalizedDescription = sanitizeText(description, 4000);
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!normalizedTitle || !normalizedOrg || !normalizedCity || !normalizedState || !normalizedDescription) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const geo = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : geocode(`${normalizedCity}, ${normalizedState}`) ?? geocode(normalizedCity);

  if (!geo) {
    res.status(400).json({ error: 'We could not place that opportunity on the map. Try a supported city and state.' });
    return;
  }

  const normalizedTags = sanitizeStringArray(tags, 60, 20);
  const safeUrl = sanitizeOptionalHttpsUrl(url);

  try {
    const { rows } = await db.query(
      `INSERT INTO opportunities
         (type, title, org, city, state, lat, lng, amount, stipend, deadline, tags, description, url, source)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), $11, $12, NULLIF($13, ''), 'community')
       RETURNING
         id::text,
         type,
         title,
         org,
         city,
         state,
         lat,
         lng,
         amount,
         stipend,
         deadline,
         match_pct AS "matchPct",
         tags,
         description,
         url`,
      [
        type,
        normalizedTitle,
        normalizedOrg,
        normalizedCity,
        normalizedState,
        geo.lat,
        geo.lng,
        sanitizeText(amount, 80),
        sanitizeText(stipend, 80),
        sanitizeText(deadline, 40),
        normalizedTags,
        normalizedDescription,
        safeUrl ?? '',
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ error: 'That opportunity already exists' });
      return;
    }

    console.error('[opportunities] insert error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
