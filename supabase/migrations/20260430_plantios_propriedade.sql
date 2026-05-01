ALTER TABLE plantios
  ADD COLUMN IF NOT EXISTS propriedade_id uuid
    REFERENCES propriedades(id) ON DELETE SET NULL;
