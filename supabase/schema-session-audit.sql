-- Preserve the CODE forecast and manual session adjustments independently.
alter table public.code_sessions
  add column if not exists forecast_metadata jsonb,
  add column if not exists original_forecast jsonb,
  add column if not exists manual_adjustments jsonb;
