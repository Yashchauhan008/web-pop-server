-- migrate:up
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- migrate:down
ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
