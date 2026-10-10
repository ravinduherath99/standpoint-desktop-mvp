-- backend/sql/setup.sql
-- StandPoint: public.shoot_plans table setup
-- Idempotent: uses IF NOT EXISTS everywhere. Safe to re-run.
-- The implicit unique index on "reference" is created by the UNIQUE constraint;
-- explicit indexes cover only user_id and created_at.

BEGIN;

CREATE TABLE IF NOT EXISTS public.shoot_plans (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference     text        UNIQUE NOT NULL,
    location      text        NOT NULL,
    shoot_date    date        NOT NULL,
    start_time    time        NOT NULL,
    duration      text        NOT NULL,
    shoot_types   jsonb       NOT NULL CHECK (jsonb_array_length(shoot_types) >= 0),
    people        integer     NOT NULL CHECK (people BETWEEN 1 AND 50),
    equipment     jsonb       NOT NULL CHECK (jsonb_array_length(equipment) >= 0),
    lighting_plan text,
    access_notes  text        NOT NULL,
    consent       boolean     NOT NULL CHECK (consent = true),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shoot_plans_user_id    ON public.shoot_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_shoot_plans_created_at ON public.shoot_plans (created_at);

ALTER TABLE public.shoot_plans ENABLE ROW LEVEL SECURITY;
-- No policies: the Python backend enforces ownership itself via user_id filtering.

COMMIT;
