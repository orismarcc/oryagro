export const ALERTAS = {
  alface: {
    npk: [
      { condicao: (v, p) => v > p.max * 0.7 + p.min * 0.3 && v <= p.max, nivel: 'warning', msg: 'Acima do ideal. Excesso de fósforo pode bloquear absorção de zinco e ferro.' },
      { condicao: (v, p) => v > p.max, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de fósforo bloqueia micronutrientes e causa toxidez.' },
      { condicao: (v, p) => v < p.min, nivel: 'info', msg: 'Abaixo do mínimo. Alface terá crescimento lento e folhas pequenas.' },
    ],
    ureia: [
      { condicao: (v, p) => v > 900, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de N causa folhas flácidas, sabor amargo e risco de queima foliar.' },
      { condicao: (v, p) => v > 700 && v <= 900, nivel: 'warning', msg: 'Acima do ideal. Pode reduzir qualidade e aumentar custo desnecessariamente.' },
      { condicao: (v, p) => v < 400, nivel: 'info', msg: 'Subdose de nitrogênio reduz tamanho e coloração das folhas.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > 15, nivel: 'error', msg: 'DOSE CRÍTICA: pH muito alto (>7.0) causa clorose por deficiência de micronutrientes.' },
      { condicao: (v, p) => v < p.min, nivel: 'info', msg: 'Dose baixa de calcário pode deixar o pH abaixo do ideal para a alface.' },
    ],
  },
  cebolinha: {
    ureia: [
      { condicao: (v, p) => v < 400, nivel: 'warning', msg: 'Rebrota lenta e produção reduzida no próximo ciclo de corte.' },
      { condicao: (v, p) => v > 900, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de N favorece fungos de solo como Fusarium.' },
    ],
    esterco: [
      { condicao: (v, p) => v > 130, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de matéria orgânica aumenta risco de Fusarium e podridões.' },
    ],
  },
  coentro: {
    ureia: [
      { condicao: (v, p) => v > 600, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de N favorece crescimento vegetativo em detrimento do aroma característico.' },
      { condicao: (v, p) => v > 450 && v <= 600, nivel: 'warning', msg: 'Acima do ideal para coentro. O aroma pode ser reduzido.' },
    ],
    nitratoCalcio: [
      { condicao: (v, p) => v > 100, nivel: 'warning', msg: 'Coentro tem ciclo muito curto — adubação foliar pesada aumenta custo sem retorno proporcional.' },
    ],
  },
  quiabo: {
    npk: [
      { condicao: (v, p) => v > 6, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de NPK pode causar salinização do solo em cultivos sequenciais.' },
    ],
    kcl: [
      { condicao: (v, p) => v < 200, nivel: 'warning', msg: 'Deficiência de potássio reduz produção e qualidade dos frutos do quiabo.' },
      { condicao: (v, p) => v < 100, nivel: 'error', msg: 'DOSE CRÍTICA: Sem potássio adequado, os frutos ficam deformados e a produção cai >40%.' },
    ],
    esterco: [
      { condicao: (v, p) => v > 160, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de matéria orgânica + umidade alta = risco severo de podridão radicular.' },
    ],
  },
  mandioca: {
    ureia: [
      { condicao: (v, p) => v > 2500, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de N favorece parte aérea em detrimento das raízes — queda de produção.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > 20, nivel: 'error', msg: 'DOSE CRÍTICA: pH > 6.5 reduz absorção de boro — micronutriente essencial para mandioca.' },
      { condicao: (v, p) => v > 16 && v <= 20, nivel: 'warning', msg: 'pH pode ultrapassar 6.5 — risco de deficiência de boro e micronutrientes.' },
    ],
  },
  abacaxi: {
    esterco: [
      { condicao: (v, p) => v > 80, nivel: 'error', msg: 'DOSE CRÍTICA: Excesso de N foliar pode antecipar o florescimento de forma indesejada.' },
      { condicao: (v, p) => v > 65 && v <= 80, nivel: 'warning', msg: 'Atenção: doses altas de matéria orgânica podem interferir no ciclo do abacaxi.' },
    ],
    sulfatoPotassio: [
      { condicao: (v, p) => v < 1500, nivel: 'error', msg: 'DOSE CRÍTICA: Potássio define acidez e aroma do fruto — não omitir ou subdosar.' },
      { condicao: (v, p) => v < 2000 && v >= 1500, nivel: 'warning', msg: 'Abaixo do ideal. Qualidade do fruto (Brix, aroma) pode ser comprometida.' },
    ],
    ethrel: [
      { condicao: (v, p) => v === 0, nivel: 'warning', msg: 'Indução floral não programada. Sem Ethrel, florescimento é irregular e a colheita fica desuniforme.' },
    ],
  },
};
