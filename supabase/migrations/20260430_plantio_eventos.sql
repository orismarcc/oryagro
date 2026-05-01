-- Migração: tabela de eventos da linha do tempo do lote
-- Substitui lógica de "total acumulado" por registros datados e rastreáveis.

CREATE TABLE IF NOT EXISTS plantio_eventos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantio_id  uuid        NOT NULL REFERENCES plantios(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text        NOT NULL, -- ex: 'estaquia','transplante','plantio_parcial','colheita','poda','adubacao','observacao','praga'
  data        date        NOT NULL,
  quantidade  numeric,              -- mudas, estacas, frutos, kg conforme contexto
  area_ha     numeric,              -- área em ha (para plantio_parcial)
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plantio_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sees_own_eventos"
  ON plantio_eventos FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_plantio_eventos_plantio_id ON plantio_eventos(plantio_id);
CREATE INDEX idx_plantio_eventos_user_data  ON plantio_eventos(user_id, data);
