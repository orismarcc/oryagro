CREATE TABLE propriedades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE propriedades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON propriedades
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
