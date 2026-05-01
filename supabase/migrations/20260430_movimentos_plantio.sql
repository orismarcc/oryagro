ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS plantio_id uuid
    REFERENCES plantios(id) ON DELETE SET NULL;
