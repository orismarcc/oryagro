-- ============================================================
-- RBAC Multi-user (FIX 10) — profiles, farm_members, triggers,
-- RLS policies e RPC lookup_user_by_email
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text        NOT NULL UNIQUE,
  display_name text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_write_own" ON public.profiles;
CREATE POLICY "profiles_write_own" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── farm_members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.farm_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     uuid        NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'technician',
  invited_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (farm_id, user_id)
);

ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farm_members_read" ON public.farm_members;
CREATE POLICY "farm_members_read" ON public.farm_members
  FOR SELECT USING (
    farm_members.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.propriedades
      WHERE id = farm_members.farm_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "farm_members_insert" ON public.farm_members;
CREATE POLICY "farm_members_insert" ON public.farm_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.propriedades p
      LEFT JOIN public.farm_members fm ON fm.farm_id = p.id AND fm.user_id = auth.uid()
      WHERE p.id = farm_members.farm_id
        AND (p.user_id = auth.uid() OR fm.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "farm_members_update" ON public.farm_members;
CREATE POLICY "farm_members_update" ON public.farm_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.propriedades p
      LEFT JOIN public.farm_members fm ON fm.farm_id = p.id AND fm.user_id = auth.uid()
      WHERE p.id = farm_members.farm_id
        AND (p.user_id = auth.uid() OR fm.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "farm_members_delete" ON public.farm_members;
CREATE POLICY "farm_members_delete" ON public.farm_members
  FOR DELETE USING (
    user_id <> (SELECT propriedades.user_id FROM public.propriedades WHERE propriedades.id = farm_members.farm_id)
    AND EXISTS (
      SELECT 1 FROM public.propriedades p
      LEFT JOIN public.farm_members fm ON fm.farm_id = p.id AND fm.user_id = auth.uid()
      WHERE p.id = farm_members.farm_id
        AND (p.user_id = auth.uid() OR fm.role = 'admin')
    )
  );

-- ── Trigger: cria perfil ao cadastrar usuário ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Trigger: auto-admin ao criar propriedade ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_farm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.farm_members (farm_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.user_id, 'admin', NEW.user_id)
  ON CONFLICT (farm_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_farm_created ON public.propriedades;
CREATE TRIGGER on_farm_created
  AFTER INSERT ON public.propriedades
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_farm();

-- ── RPC: busca usuário por e-mail (para adicionar membros) ────────────────────
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(p_email text)
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.email, p.display_name
    FROM public.profiles p
    WHERE lower(trim(p.email)) = lower(trim(p_email));
END;
$$;

-- ── RLS: propriedades — membros podem ler ────────────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_read_propriedades" ON public.propriedades;
CREATE POLICY "farm_members_can_read_propriedades" ON public.propriedades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = propriedades.id AND fm.user_id = auth.uid()
    )
  );

-- ── RLS: plantios — membros podem ler e escrever ─────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_read_plantios" ON public.plantios;
CREATE POLICY "farm_members_can_read_plantios" ON public.plantios
  FOR SELECT USING (
    propriedade_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = plantios.propriedade_id AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "farm_members_can_write_plantios" ON public.plantios;
CREATE POLICY "farm_members_can_write_plantios" ON public.plantios
  FOR INSERT WITH CHECK (
    propriedade_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = plantios.propriedade_id AND fm.user_id = auth.uid()
    )
  );

-- ── RLS: plantio_eventos — membros da farm ───────────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_access_eventos" ON public.plantio_eventos;
CREATE POLICY "farm_members_can_access_eventos" ON public.plantio_eventos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = plantio_eventos.plantio_id AND fm.user_id = auth.uid()
    )
  );

-- ── RLS: estoque_insumos — membros da farm ───────────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_access_estoque" ON public.estoque_insumos;
CREATE POLICY "farm_members_can_access_estoque" ON public.estoque_insumos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = estoque_insumos.propriedade_id AND fm.user_id = auth.uid()
    )
  );

-- ── RLS: estoque_movimentos — membros da farm ────────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_access_movimentos" ON public.estoque_movimentos;
CREATE POLICY "farm_members_can_access_movimentos" ON public.estoque_movimentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estoque_insumos ei
      JOIN public.farm_members fm ON fm.farm_id = ei.propriedade_id
      WHERE ei.id = estoque_movimentos.insumo_id AND fm.user_id = auth.uid()
    )
  );

-- ── RLS: cronograma_atividades — membros da farm ─────────────────────────────
DROP POLICY IF EXISTS "farm_members_can_access_cronograma" ON public.cronograma_atividades;
CREATE POLICY "farm_members_can_access_cronograma" ON public.cronograma_atividades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = cronograma_atividades.plantio_id AND fm.user_id = auth.uid()
    )
  );

-- ── Backfill: garantir que cada proprietário seja admin da sua farm ───────────
INSERT INTO public.farm_members (farm_id, user_id, role, invited_by)
SELECT p.id, p.user_id, 'admin', p.user_id
FROM public.propriedades p
ON CONFLICT (farm_id, user_id) DO NOTHING;

-- ── Backfill: garantir que todos os lotes tenham user_id e propriedade_id ─────
-- (Atualiza apenas lotes sem propriedade_id que pertencem a um único proprietário)
UPDATE public.plantios pl
SET
  propriedade_id = prop.id,
  user_id        = prop.user_id
FROM (
  SELECT DISTINCT p.id, p.user_id
  FROM public.propriedades p
) prop
WHERE pl.propriedade_id IS NULL
  AND pl.user_id IS NULL
  AND (SELECT COUNT(*) FROM public.propriedades) = 1;

-- ── Backfill: perfis para usuários já existentes ──────────────────────────────
INSERT INTO public.profiles (id, email, display_name)
SELECT u.id, u.email, u.raw_user_meta_data->>'display_name'
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email        = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
