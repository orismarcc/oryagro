/**
 * mapTiles.js — fontes de imagem do mapa de talhões.
 *
 * A cobertura de satélite varia MUITO por região: uma fonte pode estar
 * atualizada na sua propriedade e desatualizada na do vizinho. Por isso o
 * editor deixa o produtor trocar de fonte e escolher a que estiver melhor.
 *
 * Todas as fontes aqui são gratuitas e SEM chave de API. Ao adicionar uma nova,
 * lembre de liberar o host em `img-src` no vercel.json (a CSP bloqueia em
 * silêncio na produção) e no runtimeCaching do vite.config.js.
 */

// Versão mais recente do Esri Wayback (snapshot datado do acervo World Imagery).
// Serve para COMPARAR com o passado — não traz imagem mais nova que a atual.
const WAYBACK = (release) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;

export const FONTES_MAPA = [
  {
    id: 'esri',
    label: 'Satélite (Esri)',
    tipo: 'satelite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagens © Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    nota: 'Acervo atual da Esri. Cobertura e data variam por região.',
  },
  {
    id: 'clarity',
    label: 'Satélite HD (Clarity)',
    tipo: 'satelite',
    url: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagens © Esri Clarity',
    maxZoom: 19,
    nota: 'Versão curada por nitidez — às vezes mais limpa que a padrão.',
  },
  {
    id: 'wayback_2025',
    label: 'Satélite 2025',
    tipo: 'satelite',
    url: WAYBACK('58924'), // release de 2025-09-25
    attribution: 'Imagens © Esri Wayback (2025)',
    maxZoom: 19,
    nota: 'Imagem histórica de set/2025 — útil para comparar a evolução da área.',
  },
  {
    id: 'osm',
    label: 'Mapa (ruas)',
    tipo: 'mapa',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
    nota: 'Mapa de ruas — ajuda a se localizar por estradas e referências.',
  },
];

export const FONTE_PADRAO = 'esri';

export function getFonte(id) {
  return FONTES_MAPA.find(f => f.id === id) || FONTES_MAPA[0];
}
