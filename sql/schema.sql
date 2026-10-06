-- SERP Monitor production schema
-- No seed/dummy/sample rows are inserted.

CREATE TABLE IF NOT EXISTS keywords (
    id BIGSERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS captures (
    id BIGSERIAL PRIMARY KEY,
    keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'excel',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_captures_keyword_time UNIQUE (keyword_id, captured_at)
);

CREATE TABLE IF NOT EXISTS serp_results (
    id BIGSERIAL PRIMARY KEY,
    capture_id BIGINT NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 100),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    url TEXT,
    title TEXT,
    CONSTRAINT uq_serp_results_capture_rank UNIQUE (capture_id, rank)
);

CREATE INDEX IF NOT EXISTS ix_captures_keyword_time
    ON captures (keyword_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS ix_serp_results_keyword
    ON serp_results (keyword_id);

CREATE INDEX IF NOT EXISTS ix_serp_results_keyword_domain
    ON serp_results (keyword_id, domain);
