ALTER TABLE estoque_insumos
  ADD COLUMN IF NOT EXISTS propriedade_id uuid
    REFERENCES propriedades(id) ON DELETE CASCADE;
