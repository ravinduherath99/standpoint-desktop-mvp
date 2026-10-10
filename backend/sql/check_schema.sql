-- backend/sql/check_schema.sql
-- Read-only schema verification queries for public.shoot_plans.
-- Each query returns a single boolean column "ok": true = PASS, false = FAIL.
-- Shared by check_tables.py and init_database.py to avoid inconsistent preflight rules.

-- 1. table_exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shoot_plans'
) AS ok;

-- 2. columns_complete (exactly 14 columns)
SELECT (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shoot_plans') = 14 AS ok;

-- 3. column_types (all 14 column/type pairs match PostgreSQL udt_name)
SELECT (SELECT count(*) FROM (
    SELECT expected.column_name, expected.expected_type FROM (VALUES
        ('id',            'uuid'),
        ('user_id',       'uuid'),
        ('reference',     'text'),
        ('location',      'text'),
        ('shoot_date',    'date'),
        ('start_time',    'time'),
        ('duration',      'text'),
        ('shoot_types',   'jsonb'),
        ('people',        'int4'),
        ('equipment',     'jsonb'),
        ('lighting_plan', 'text'),
        ('access_notes',  'text'),
        ('consent',       'bool'),
        ('created_at',    'timestamptz')
    ) AS expected(column_name, expected_type)
    JOIN information_schema.columns c
      ON c.column_name = expected.column_name
     AND c.table_schema = 'public'
     AND c.table_name = 'shoot_plans'
     AND c.udt_name = expected.expected_type
    ) matched) = 14 AS ok;

-- 4. id_primary_key
SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'shoot_plans'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'id'
) AS ok;

-- 5. reference_unique
SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'shoot_plans'
      AND constraint_type = 'UNIQUE'
      AND constraint_name IN (
          SELECT constraint_name FROM information_schema.constraint_column_usage
          WHERE table_schema = 'public' AND table_name = 'shoot_plans'
            AND column_name = 'reference'
      )
) AS ok;

-- 6. user_id_fk (foreign key to auth.users with ON DELETE CASCADE)
SELECT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
     AND rc.constraint_schema = kcu.constraint_schema
    WHERE rc.constraint_schema = 'public'
      AND kcu.table_name = 'shoot_plans'
      AND kcu.column_name = 'user_id'
      AND rc.unique_constraint_schema = 'auth'
      AND rc.unique_constraint_name IN (
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_schema = 'auth' AND table_name = 'users'
            AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      )
      AND rc.delete_rule = 'CASCADE'
) AS ok;

-- 7. shoot_types_json_array_check (jsonb_array_length ensures array type)
SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name
     AND cc.constraint_schema = ccu.constraint_schema
    WHERE cc.constraint_schema = 'public'
      AND ccu.table_name = 'shoot_plans'
      AND ccu.column_name = 'shoot_types'
      AND cc.check_clause LIKE '%jsonb_array_length%'
) AS ok;

-- 8. equipment_json_array_check
SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name
     AND cc.constraint_schema = ccu.constraint_schema
    WHERE cc.constraint_schema = 'public'
      AND ccu.table_name = 'shoot_plans'
      AND ccu.column_name = 'equipment'
      AND cc.check_clause LIKE '%jsonb_array_length%'
) AS ok;

-- 9. people_range_check (BETWEEN 1 AND 50)
SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name
     AND cc.constraint_schema = ccu.constraint_schema
    WHERE cc.constraint_schema = 'public'
      AND ccu.table_name = 'shoot_plans'
      AND ccu.column_name = 'people'
      AND cc.check_clause LIKE '%1%'
      AND cc.check_clause LIKE '%50%'
) AS ok;

-- 10. consent_true_check (consent = true)
SELECT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON cc.constraint_name = ccu.constraint_name
     AND cc.constraint_schema = ccu.constraint_schema
    WHERE cc.constraint_schema = 'public'
      AND ccu.table_name = 'shoot_plans'
      AND ccu.column_name = 'consent'
      AND cc.check_clause LIKE '%true%'
) AS ok;

-- 11. indexes_present (exactly 2 named indexes: user_id and created_at)
SELECT (SELECT count(*) FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'shoot_plans'
          AND indexname IN ('idx_shoot_plans_user_id', 'idx_shoot_plans_created_at')) = 2 AS ok;

-- 12. rls_enabled
SELECT (SELECT relrowsecurity FROM pg_class
        WHERE relname = 'shoot_plans'
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) AS ok;

-- 13. no_table_policies (zero browser-facing policies)
SELECT (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'shoot_plans') = 0 AS ok;

-- 14. no_signup_triggers (no unexpected triggers on shoot_plans)
SELECT (SELECT count(*) FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'shoot_plans') = 0 AS ok;
