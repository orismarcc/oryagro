/**
 * CroquiGenerator.jsx — gera o croqui de plantio (covas) sobre a área demarcada.
 *
 * 100% no aparelho, sem IA: usa lib/croqui (geometria pura). Configura
 * espaçamento e recuo de cerca por aresta, com preview ao vivo (proporção real
 * do talhão) e download em IMAGEM (PNG) — ou KML para marcar por GPS.
 */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Grid3x3, Image as ImageIcon, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { gerarCroqui } from '../lib/croqui';

const NS = 'http://www.w3.org/2000/svg';

function baixarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function baixarKML(nome, covas, culturaNome) {
  const pm = covas.map((p, i) =>
    `  <Placemark><name>${i + 1}</name><styleUrl>#a</styleUrl><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${nome}</name>
 <Style id="a"><IconStyle><color>ff2ea62e</color><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
 <Folder><name>${culturaNome} (${covas.length})</name>
${pm}
 </Folder>
</Document></kml>`;
  baixarBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), `${nome}.kml`);
}

/** Renderiza o SVG do croqui numa imagem PNG de alta resolução. */
function svgParaPng(svgEl, filename) {
  return new Promise((resolve, reject) => {
    const vb = svgEl.viewBox.baseVal;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('width', vb.width);
    clone.setAttribute('height', vb.height);
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', vb.x); bg.setAttribute('y', vb.y);
    bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height);
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    const s = new XMLSerializer().serializeToString(clone);
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(60, Math.max(20, 2400 / Math.max(vb.width, vb.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vb.width * scale);
      canvas.height = Math.round(vb.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => { blob ? (baixarBlob(blob, `${filename}.png`), resolve()) : reject(); }, 'image/png');
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function CroquiGenerator({ pontos, culturaNome = 'Cultura', cor = '#16a34a', onClose }) {
  const toast = useToast();
  const svgRef = useRef(null);
  const [dx, setDx] = useState('4');
  const [dy, setDy] = useState('4');
  const [recuo, setRecuo] = useState('2');
  const [cercaIdx, setCercaIdx] = useState([]);
  const [baixando, setBaixando] = useState(false);

  const cro = useMemo(() => gerarCroqui({
    pontos,
    dx: parseFloat(dx) || 0,
    dy: parseFloat(dy) || 0,
    cercaIdx,
    recuoM: parseFloat(recuo) || 0,
  }), [pontos, dx, dy, recuo, cercaIdx]);

  const toggleCerca = (i) => setCercaIdx(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  // ── Geometria do SVG (proporção real do talhão) ──
  const svg = useMemo(() => {
    const V = cro.poligonoXY;
    if (!V.length) return null;
    const xs = V.map(p => p.x), ys = V.map(p => p.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const PAD = 8, W = (maxx - minx) + 2 * PAD, H = (maxy - miny) + 2 * PAD;
    const sx = x => (x - minx) + PAD, sy = y => (maxy - y) + PAD;
    return { W, H, sx, sy, V, maxy };
  }, [cro]);

  const nomeArq = `croqui-${culturaNome}-${(parseFloat(dx) || 4)}x${(parseFloat(dy) || 4)}`.toLowerCase().replace(/\s+/g, '-');

  const baixarPng = async () => {
    if (!cro.covas.length || !svgRef.current) { toast.error('Ajuste os parâmetros — nenhuma cova cabe na área.'); return; }
    setBaixando(true);
    try { await svgParaPng(svgRef.current, nomeArq); toast.success('Croqui salvo como imagem (PNG).'); }
    catch { toast.error('Não foi possível gerar a imagem.'); }
    finally { setBaixando(false); }
  };
  const baixarGps = () => {
    if (!cro.covas.length) { toast.error('Nenhuma cova para exportar.'); return; }
    try { baixarKML(nomeArq, cro.covas, culturaNome); toast.success('KML exportado — abra no Google Earth/GPS.'); }
    catch { toast.error('Não foi possível exportar o KML.'); }
  };

  const inputCls = 'w-full rounded-xl border px-3 py-2 text-sm bg-background outline-none';
  const bd = { borderColor: `${cor}40` };

  // barra de escala de 10 m no croqui
  const escalaPx = svg ? 10 : 0;

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
        <div className="gradient-hero text-white px-4 py-3 flex items-center gap-2">
          <Grid3x3 size={17} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight">Croqui de plantio</p>
            <p className="text-[10.5px] text-white/70">{cro.area.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Preview — proporção real do talhão (não corta) */}
          {svg && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(152 14% 84%)', background: '#f3f5f1' }}>
              <svg ref={svgRef} viewBox={`0 0 ${svg.W} ${svg.H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', height: 'auto', maxHeight: '48vh', display: 'block' }}>
                <path d={'M' + svg.V.map(p => `${svg.sx(p.x).toFixed(2)},${svg.sy(p.y).toFixed(2)}`).join(' L') + ' Z'}
                  fill={`${cor}18`} stroke={cor} strokeWidth={0.5} strokeLinejoin="round" />
                {cercaIdx.map(i => {
                  const a = svg.V[i], b = svg.V[(i + 1) % svg.V.length];
                  return <line key={i} x1={svg.sx(a.x)} y1={svg.sy(a.y)} x2={svg.sx(b.x)} y2={svg.sy(b.y)}
                    stroke="#1f6feb" strokeWidth={1.1} strokeLinecap="round" />;
                })}
                {cro.covas.map((p, i) => <circle key={'p' + i} cx={svg.sx(p.x).toFixed(2)} cy={svg.sy(p.y).toFixed(2)} r={0.7} fill={cor} />)}
                {/* barra de escala 10 m */}
                <line x1={4} y1={svg.H - 4} x2={4 + escalaPx} y2={svg.H - 4} stroke="#334036" strokeWidth={0.5} />
                <line x1={4} y1={svg.H - 5.4} x2={4} y2={svg.H - 2.6} stroke="#334036" strokeWidth={0.5} />
                <line x1={4 + escalaPx} y1={svg.H - 5.4} x2={4 + escalaPx} y2={svg.H - 2.6} stroke="#334036" strokeWidth={0.5} />
                <text x={4 + escalaPx / 2} y={svg.H - 6} fontSize={2.6} textAnchor="middle" fill="#5c6b60">10 m</text>
              </svg>
            </div>
          )}

          {/* Contagem */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
              <p className="text-[18px] font-black leading-none" style={{ color: cor }}>{cro.covas.length}</p>
              <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">covas de {culturaNome}</p>
            </div>
            <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
              <p className="text-[18px] font-black leading-none" style={{ color: cor }}>{cro.covas.length ? Math.round(cro.covas.length / (cro.area || 1)) : 0}</p>
              <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">covas/ha</p>
            </div>
          </div>

          {/* Espaçamento */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Espaçamento (m)</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" step="0.5" min="0.5" value={dx} onChange={e => setDx(e.target.value)} className={inputCls} style={bd} placeholder="entre plantas" />
              <span className="text-muted-foreground text-sm">×</span>
              <input type="number" step="0.5" min="0.5" value={dy} onChange={e => setDy(e.target.value)} className={inputCls} style={bd} placeholder="entre linhas" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">plantas × linhas — linhas paralelas ao maior lado do talhão</p>
          </div>

          {/* Cerca */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cerca — marque os lados e o recuo</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {cro.arestas.map(e => (
                <button key={e.i} type="button" onClick={() => toggleCerca(e.i)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={cercaIdx.includes(e.i)
                    ? { background: '#1f6feb', color: 'white' }
                    : { background: 'hsl(210 30% 93%)', color: '#1f6feb' }}>
                  Lado {e.i + 1} · {Math.round(e.len)} m
                </button>
              ))}
            </div>
            {cercaIdx.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-muted-foreground">Recuo da cerca:</span>
                <input type="number" step="0.5" min="0" value={recuo} onChange={e => setRecuo(e.target.value)}
                  className="w-20 rounded-xl border px-2 py-1.5 text-sm bg-background" style={bd} />
                <span className="text-[11px] text-muted-foreground">m</span>
              </div>
            )}
          </div>

          <p className="text-[9.5px] text-muted-foreground/80 leading-tight">
            Grade geométrica cheia — se deixar carreador/bordadura, o número real cai um pouco. Confira sempre o manejo da cultura.
          </p>
        </div>

        <div className="p-3 border-t border-border flex-shrink-0 flex gap-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button onClick={baixarGps} disabled={!cro.covas.length}
            className="px-3 py-3 rounded-xl font-bold text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: 'hsl(210 30% 93%)', color: '#1f6feb' }}>
            <MapPin size={14} /> GPS
          </button>
          <button onClick={baixarPng} disabled={baixando || !cro.covas.length}
            className="flex-1 py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: cor }}>
            {baixando ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            Baixar croqui (imagem)
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
