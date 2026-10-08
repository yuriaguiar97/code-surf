-- Allow the full surf evaluation scale, including zero.
BEGIN;
ALTER TABLE public.code_sessions DROP CONSTRAINT code_sessions_score_check;
ALTER TABLE public.code_sessions ADD CONSTRAINT code_sessions_score_check CHECK (score >= 0 AND score <= 10);
COMMIT;
