-- Migration: Add dia_previsto to cronograma_atividades unique constraint
-- This prevents two custom rows with the same etapa name but different days
-- from silently merging (the old constraint was only on plantio_id+etapa+is_custom).
--
-- Run this in Supabase SQL Editor:

-- Step 1: Remove duplicate rows (keep newest by updated_at)
DELETE FROM cronograma_atividades a
USING cronograma_atividades b
WHERE a.id < b.id
  AND a.plantio_id = b.plantio_id
  AND a.etapa = b.etapa
  AND a.dia_previsto = b.dia_previsto
  AND a.is_custom = b.is_custom;

-- Step 2: Drop old unique constraint (name may vary — check with \d cronograma_atividades)
ALTER TABLE cronograma_atividades
  DROP CONSTRAINT IF EXISTS cronograma_atividades_plantio_id_etapa_is_custom_key;

-- Step 3: Add new unique constraint including dia_previsto
ALTER TABLE cronograma_atividades
  ADD CONSTRAINT cronograma_atividades_plantio_etapa_dia_custom_unique
  UNIQUE (plantio_id, etapa, dia_previsto, is_custom);
