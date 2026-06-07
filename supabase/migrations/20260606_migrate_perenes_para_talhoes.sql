-- ── 20260606_migrate_perenes_para_talhoes.sql ────────────────────────────────
-- Migração de dados (one-time, idempotente).
--
-- O módulo de culturas perenes (talhões + safras) foi criado depois de já
-- existirem plantios de culturas perenes cadastrados como "lotes anuais"
-- (tipo_cultura='anual', sem talhao_id). Esta migração converte cada um desses
-- plantios na estrutura perene correta, SEM perder nenhum dado vinculado:
--
--   • Cria um talhão copiando os atributos do plantio.
--   • Vincula o próprio plantio como Safra 1 (talhao_id, tipo_cultura='perene',
--     safra_numero=1, nome "… — Safra 1").
--   • cronograma_atividades, despesas, vendas, eventos e estoque continuam
--     atrelados ao MESMO plantio (mesmo id) — nada é recriado, nada quebra.
--
-- Idempotente: só atua em plantios de cultura perene que ainda não têm talhao_id.
-- A lista de culturas perenes vem de src/data/culturas.js (tipoCultura:'perene').
-- ─────────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  p RECORD;
  v_talhao_id uuid;
BEGIN
  FOR p IN
    SELECT * FROM public.plantios
    WHERE cultura_id IN ('acerola','cupuacu','banana_ana','mamao_tainung')
      AND talhao_id IS NULL
  LOOP
    INSERT INTO public.talhoes (
      user_id, propriedade_id, nome, cultura_id, data_implantacao,
      area_ha, total_plantas, metodo_propagacao,
      espacamento_linhas, espacamento_plantas, status
    ) VALUES (
      p.user_id, p.propriedade_id, p.nome, p.cultura_id, p.data_plantio,
      p.area_ha, p.total_plantas, p.metodo_propagacao,
      p.espacamento_linhas, p.espacamento_plantas, 'ativo'
    )
    RETURNING id INTO v_talhao_id;

    UPDATE public.plantios
    SET talhao_id    = v_talhao_id,
        tipo_cultura = 'perene',
        safra_numero = 1,
        -- chr(8212) = em-dash (—); usar o codepoint evita corrupção de encoding
        -- caso a migration seja aplicada por uma ferramenta que mangle UTF-8.
        nome         = p.nome || ' ' || chr(8212) || ' Safra 1'
    WHERE id = p.id;

    RAISE NOTICE 'Migrado plantio % (%) -> talhão %', p.id, p.cultura_id, v_talhao_id;
  END LOOP;
END $mig$;
