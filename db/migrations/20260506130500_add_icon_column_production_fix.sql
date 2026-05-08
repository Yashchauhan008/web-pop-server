-- migrate:up
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS icon character varying(255) DEFAULT 'bell';

-- migrate:down
ALTER TABLE reminders DROP COLUMN IF EXISTS icon;
