// All thresholds use p.max / p.min so they scale correctly when
// scaledParams() is applied from SimuladorFinanceiro.

export const ALERTAS = {
  alface: {
    npk: [
      { condicao: (v, p) => v > (p.max ?? 4),                                  nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de fósforo bloqueia micronutrientes e causa toxidez.' },
      { condicao: (v, p) => v > (p.max ?? 4) * 0.85 && v <= (p.max ?? 4),      nivel: 'warning', msg: 'Acima do ideal. Excesso de fósforo pode bloquear absorção de zinco e ferro.' },
      { condicao: (v, p) => v < (p.min ?? 1.5),                                 nivel: 'info',    msg: 'Abaixo do mínimo. Alface terá crescimento lento e folhas pequenas.' },
    ],
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 900),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N causa folhas flácidas, sabor amargo e risco de queima foliar.' },
      { condicao: (v, p) => v > (p.max ?? 900) * 0.78 && v <= (p.max ?? 900),  nivel: 'warning', msg: 'Acima do ideal. Pode reduzir qualidade e aumentar custo desnecessariamente.' },
      { condicao: (v, p) => v < (p.min ?? 400),                                 nivel: 'info',    msg: 'Subdose de nitrogênio reduz tamanho e coloração das folhas.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > (p.max ?? 15),                                  nivel: 'error',   msg: 'DOSE CRÍTICA: pH muito alto (>7.0) causa clorose por deficiência de micronutrientes.' },
      { condicao: (v, p) => v < (p.min ?? 4),                                   nivel: 'info',    msg: 'Dose baixa de calcário pode deixar o pH abaixo do ideal para a alface.' },
    ],
  },
  cebolinha: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 900),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N favorece fungos de solo como Fusarium.' },
      { condicao: (v, p) => v < (p.min ?? 400),                                 nivel: 'warning', msg: 'Rebrota lenta e produção reduzida no próximo ciclo de corte.' },
    ],
    esterco: [
      { condicao: (v, p) => v > (p.max ?? 130),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de matéria orgânica aumenta risco de Fusarium e podridões.' },
    ],
  },
  coentro: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 600),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N favorece crescimento vegetativo em detrimento do aroma característico.' },
      { condicao: (v, p) => v > (p.max ?? 600) * 0.75 && v <= (p.max ?? 600),  nivel: 'warning', msg: 'Acima do ideal para coentro. O aroma pode ser reduzido.' },
    ],
    nitratoCalcio: [
      { condicao: (v, p) => v > (p.max ?? 200) * 0.5,                           nivel: 'warning', msg: 'Coentro tem ciclo muito curto — adubação foliar pesada aumenta custo sem retorno proporcional.' },
    ],
  },
  quiabo: {
    npk: [
      { condicao: (v, p) => v > (p.max ?? 700),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de NPK pode causar salinização do solo em cultivos sequenciais.' },
    ],
    esterco: [
      { condicao: (v, p) => v > (p.max ?? 25000),                               nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de matéria orgânica + umidade alta = risco severo de podridão radicular.' },
    ],
  },
  mandioca: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 200),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N favorece parte aérea em detrimento das raízes — queda de produção.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > (p.max ?? 4000),                                nivel: 'error',   msg: 'DOSE CRÍTICA: pH > 6.5 reduz absorção de boro — micronutriente essencial para mandioca.' },
      { condicao: (v, p) => v > (p.max ?? 4000) * 0.85 && v <= (p.max ?? 4000),nivel: 'warning', msg: 'pH pode ultrapassar 6.5 — risco de deficiência de boro e micronutrientes.' },
    ],
  },
  abacaxi: {
    esterco: [
      { condicao: (v, p) => v > (p.max ?? 12000),                               nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N foliar pode antecipar o florescimento de forma indesejada.' },
      { condicao: (v, p) => v > (p.max ?? 12000) * 0.8 && v <= (p.max ?? 12000), nivel: 'warning', msg: 'Atenção: doses altas de matéria orgânica podem interferir no ciclo do abacaxi.' },
    ],
  },
  rucula: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 400),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N torna as folhas amargas e perde o sabor característico da rúcula.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > (p.max ?? 10),                                  nivel: 'error',   msg: 'DOSE CRÍTICA: pH > 7.0 compromete absorção de micronutrientes pela rúcula.' },
    ],
  },
  couve: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 1000),                                nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N favorece pragas e doenças foliares na couve.' },
      { condicao: (v, p) => v < (p.min ?? 400),                                 nivel: 'info',    msg: 'Dose baixa de N reduz tamanho e cor das folhas.' },
    ],
  },
  banana_ana: {
    ureia: [
      { condicao: (v, p) => v > (p.max ?? 200),                                 nivel: 'error',   msg: 'DOSE CRÍTICA: Excesso de N reduz qualidade e vida pós-colheita das bananas.' },
    ],
    calcareo: [
      { condicao: (v, p) => v > (p.max ?? 4000),                                nivel: 'error',   msg: 'DOSE CRÍTICA: pH > 6.5 reduz absorção de micronutrientes como zinco e manganês.' },
    ],
  },
};
