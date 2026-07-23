/**
 * defensivos.js — catálogo de CONVENIÊNCIA para o Caderno de Campo.
 *
 * Objetivo: acelerar o preenchimento sugerindo o ingrediente ativo e a classe
 * a partir do nome comercial mais conhecido. NÃO traz número de registro MAPA
 * nem período de carência — esses dependem da formulação/cultura específica e
 * DEVEM ser copiados do rótulo do produto e do receituário agronômico pelo
 * usuário. Todos os campos permanecem editáveis.
 *
 * As classes seguem a nomenclatura MAPA de agrotóxicos.
 */

export const CLASSES_APLICACAO = [
  { value: 'herbicida',  label: 'Herbicida' },
  { value: 'fungicida',  label: 'Fungicida' },
  { value: 'inseticida', label: 'Inseticida' },
  { value: 'acaricida',  label: 'Acaricida' },
  { value: 'nematicida', label: 'Nematicida' },
  { value: 'adubo',      label: 'Adubo / Fertilizante' },
  { value: 'foliar',     label: 'Adubo foliar / Bioestimulante' },
  { value: 'corretivo',  label: 'Corretivo (calcário/gesso)' },
  { value: 'outro',      label: 'Outro' },
];

export const TIPOS_APLICACAO = [
  { value: 'defensivo',  label: '🧪 Defensivo (agrotóxico)' },
  { value: 'adubacao',   label: '🌾 Adubação (solo)' },
  { value: 'foliar',     label: '🍃 Foliar' },
  { value: 'calagem',    label: '⛰ Calagem / Correção' },
  { value: 'outro',      label: '📌 Outro' },
];

/**
 * Sugestões por nome comercial conhecido (busca por prefixo, case-insensitive).
 * classe + ingrediente ativo são estáveis; o resto o usuário confirma no rótulo.
 */
export const CATALOGO_PRODUTOS = [
  // Herbicidas
  { produto: 'Roundup',      ingrediente_ativo: 'Glifosato',                 classe: 'herbicida' },
  { produto: 'Gramoxone',    ingrediente_ativo: 'Paraquate',                 classe: 'herbicida' },
  { produto: 'Select',       ingrediente_ativo: 'Cletodim',                  classe: 'herbicida' },
  { produto: 'Atrazina',     ingrediente_ativo: 'Atrazina',                  classe: 'herbicida' },
  // Fungicidas
  { produto: 'Manzate',      ingrediente_ativo: 'Mancozebe',                 classe: 'fungicida' },
  { produto: 'Dithane',      ingrediente_ativo: 'Mancozebe',                 classe: 'fungicida' },
  { produto: 'Cabrio Top',   ingrediente_ativo: 'Piraclostrobina + Metiram', classe: 'fungicida' },
  { produto: 'Score',        ingrediente_ativo: 'Difenoconazol',             classe: 'fungicida' },
  { produto: 'Calda Bordalesa', ingrediente_ativo: 'Sulfato de cobre + Cal', classe: 'fungicida' },
  // Inseticidas / acaricidas
  { produto: 'Karate',       ingrediente_ativo: 'Lambda-cialotrina',         classe: 'inseticida' },
  { produto: 'Decis',        ingrediente_ativo: 'Deltametrina',              classe: 'inseticida' },
  { produto: 'Connect',      ingrediente_ativo: 'Imidacloprido + Beta-ciflutrina', classe: 'inseticida' },
  { produto: 'Vertimec',     ingrediente_ativo: 'Abamectina',               classe: 'acaricida' },
  { produto: 'Oberon',       ingrediente_ativo: 'Espiromesifeno',            classe: 'acaricida' },
  // Adubos / corretivos comuns
  { produto: 'Ureia',            ingrediente_ativo: 'Nitrogênio 45%',        classe: 'adubo' },
  { produto: 'NPK 04-14-08',     ingrediente_ativo: 'N-P-K',                 classe: 'adubo' },
  { produto: 'NPK 20-05-20',     ingrediente_ativo: 'N-P-K',                 classe: 'adubo' },
  { produto: 'Nitrato de Cálcio', ingrediente_ativo: 'Nitrato de cálcio',    classe: 'foliar' },
  { produto: 'Cloreto de Potássio', ingrediente_ativo: 'K2O 60%',           classe: 'adubo' },
  { produto: 'Calcário Dolomítico', ingrediente_ativo: 'CaO + MgO',          classe: 'corretivo' },
  { produto: 'Gesso Agrícola',   ingrediente_ativo: 'Sulfato de cálcio',     classe: 'corretivo' },
];

/** Retorna a 1ª sugestão cujo nome começa com o texto digitado. */
export function sugerirProduto(texto) {
  if (!texto || texto.length < 2) return null;
  const t = texto.trim().toLowerCase();
  return CATALOGO_PRODUTOS.find(p => p.produto.toLowerCase().startsWith(t)) ||
         CATALOGO_PRODUTOS.find(p => p.produto.toLowerCase().includes(t)) || null;
}

export function classeLabel(value) {
  return CLASSES_APLICACAO.find(c => c.value === value)?.label ?? value ?? '—';
}

export function tipoLabel(value) {
  return TIPOS_APLICACAO.find(t => t.value === value)?.label ?? value ?? '—';
}
