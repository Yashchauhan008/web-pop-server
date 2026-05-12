-- migrate:up
ALTER TABLE devices ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- migrate:down
ALTER TABLE devices DROP COLUMN IF EXISTS nickname;
