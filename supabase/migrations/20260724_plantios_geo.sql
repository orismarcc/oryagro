-- Geometria demarcada também nos lotes/safras (plantios) — igual aos talhões
alter table public.plantios add column if not exists latitude    numeric;
alter table public.plantios add column if not exists longitude   numeric;
alter table public.plantios add column if not exists geojson     jsonb;
alter table public.plantios add column if not exists area_gps_ha numeric;
