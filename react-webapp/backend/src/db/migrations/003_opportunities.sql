CREATE TABLE IF NOT EXISTS opportunities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(20) NOT NULL,
  title       TEXT        NOT NULL,
  org         TEXT        NOT NULL,
  city        TEXT,
  state       TEXT,
  lat         FLOAT,
  lng         FLOAT,
  amount      TEXT,
  stipend     TEXT,
  deadline    TEXT,
  match_pct   INT         DEFAULT 75,
  tags        TEXT[]      DEFAULT '{}',
  description TEXT,
  url         TEXT,
  source      TEXT,
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (title, org, type)
);

CREATE INDEX IF NOT EXISTS idx_opp_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_opp_scraped ON opportunities(scraped_at);
