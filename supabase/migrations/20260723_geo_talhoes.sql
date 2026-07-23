-- Georreferenciamento de talhões (#7) e localização das propriedades (base do clima #8)
alter table public.talhoes      add column if not exists latitude    numeric;
alter table public.talhoes      add column if not exists longitude   numeric;
alter table public.talhoes      add column if not exists geojson     jsonb;    -- polígono do talhão (lista de [lng,lat])
alter table public.talhoes      add column if not exists area_gps_ha numeric;  -- área calculada pela geometria

alter table public.propriedades add column if not exists latitude    numeric;
alter table public.propriedades add column if not exists longitude   numeric;
