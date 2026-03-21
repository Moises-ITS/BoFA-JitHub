import { Router } from 'express';
import { db } from '../config/postgres.js';

const router = Router();

/** GET /api/opportunities?type=all&limit=200 */
router.get('/', async (req, res) => {
  const type  = req.query.type as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

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

export default router;
