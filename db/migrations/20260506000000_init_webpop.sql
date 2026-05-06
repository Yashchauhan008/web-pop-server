-- migrate:up

ALTER TABLE public.users ADD COLUMN firebase_uid text UNIQUE;
ALTER TABLE public.users ADD COLUMN avatar_url text;

CREATE TABLE public.reminders (
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    message text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    recurrence_type text NOT NULL, -- once, hourly, daily, weekly, monthly, custom
    recurrence_interval integer,
    timezone text DEFAULT 'UTC' NOT NULL,
    next_trigger_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tags (
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    color text,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(name, user_id)
);

CREATE TABLE public.reminder_tags (
    reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (reminder_id, tag_id)
);

CREATE TABLE public.devices (
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    fcm_token text NOT NULL UNIQUE,
    browser text,
    os text,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notification_logs (
    id uuid DEFAULT uuidv7() NOT NULL PRIMARY KEY,
    status text NOT NULL, -- sent, failed, clicked
    error text,
    reminder_id uuid REFERENCES public.reminders(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    clicked_at timestamp with time zone
);

-- migrate:down

DROP TABLE public.notification_logs;
DROP TABLE public.devices;
DROP TABLE public.reminder_tags;
DROP TABLE public.tags;
DROP TABLE public.reminders;
ALTER TABLE public.users DROP COLUMN avatar_url;
ALTER TABLE public.users DROP COLUMN firebase_uid;
