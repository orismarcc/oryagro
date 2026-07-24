/**
 * CroquiGenerator.jsx — gera o croqui de plantio (covas) sobre a área demarcada.
 *
 * 100% no aparelho, sem IA: usa lib/croqui (geometria pura). Deixa configurar
 * espaçamento, recuo de cerca por aresta e um consórcio opcional nas entrelinhas,
 * com preview ao vivo e download em KML (para marcar as covas por GPS).
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Grid3x3, Download, Loader2, Sprout } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { gerarCroqui } from '../lib/croqui';

const NS = 'http://www.w3.org/2000/svg';

function baixarKML(nome, principal, consorcio, nomePrinc, nomeCons) {
  const pm = (arr, style) => arr.map((p, i) =>
    `  <Placemark><name>${i + 1}</name><styleUrl>#${style}</styleUrl><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${nome}</name>
 <Style id="a"><IconStyle><color>ff2ea62e</color><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
 <Style id="b"><IconStyle><color>ff3b30d1</color><scale>0.5</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>
 <Folder><name>${nomePrinc} (${principal.length})</name>
${pm(principal, 'a')}
 </Folder>${consorcio.length ? `
 <Folder><name>${nomeCons} (${consorcio.length})</name>
${pm(consorcio, 'b')}
 </Folder>` : ''}
</Document></kml>`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${nome}.kml`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function CroquiGenerator({ pontos, culturaNome = 'Cultura', cor = '#16a34a', onClose }) {
  const toast = useToast();
  const [dx, setDx] = useState('4');
  const [dy, setDy] = useState('4');
  const [recuo, setRecuo] = useState('2');
  const [cercaIdx, setCercaIdx] = useState([]);
  const [temConsorcio, setTemConsorcio] = useState(false);
  const [consorcioNome, setConsorcioNome] = useState('Maracujá');
  const [consorcioDx, setConsorcioDx] = useState('2.5');
  const [baixando, setBaixando] = useState(false);

  const cro = useMemo(() => gerarCroqui({
    pontos,
    dx: parseFloat(dx) || 0,
    dy: parseFloat(dy) || 0,
    cercaIdx,
    recuoM: parseFloat(recuo) || 0,
    consorcio: temConsorcio && parseFloat(consorcioDx) > 0 ? { dx: parseFloat(consorcioDx) } : null,
  }), [pontos, dx, dy, recuo, cercaIdx, temConsorcio, consorcioDx]);

  const toggleCerca = (i) => setCercaIdx(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  // ── SVG preview ──
  const svg = useMemo(() => {
    const V = cro.poligonoXY;
    if (!V.length) return null;
    const xs = V.map(p => p.x), ys = V.map(p => p.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const PAD = 6, W = (maxx - minx) + 2 * PAD, H = (maxy - miny) + 2 * PAD;
    const sx = x => (x - minx) + PAD, sy = y => (maxy - y) + PAD;
    return { W, H, sx, sy, V };
  }, [cro]);

  const baixar = () => {
    if (!cro.covas.length) { toast.error('Ajuste os parâmetros — nenhuma cova cabe na área.'); return; }
    setBaixando(true);
    try {
      baixarKML(`croqui-${culturaNome}`.toLowerCase().replace(/\s+/g, '-'),
        cro.covas, cro.consorcio, culturaNome, consorcioNome);
      toast.success('Croqui exportado (KML) — abra no Google Earth/GPS.');
    } catch { toast.error('Não foi possível exportar.'); }
    finally { setBaixando(false); }
  };

  const inputCls = 'w-full rounded-xl border px-3 py-2 text-sm bg-background outline-none';
  const bd = { borderColor: `${cor}40` };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
        <div className="gradient-hero text-white px-4 py-3 flex items-center gap-2">
          <Grid3x3 size={17} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight">Croqui de plantio</p>
            <p className="text-[10.5px] text-white/70">{cro.area.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ha · covas por GPS</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Preview */}
          {svg && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'hsl(152 14% 84%)', background: '#f3f5f1' }}>
              <svg viewBox={`0 0 ${svg.W} ${svg.H}`} style={{ width: '100%', height: 220, display: 'block' }}>
                <path d={'M' + svg.V.map(p => `${svg.sx(p.x).toFixed(2)},${svg.sy(p.y).toFixed(2)}`).join(' L') + ' Z'}
                  fill={`${cor}18`} stroke={cor} strokeWidth={0.5} strokeLinejoin="round" />
                {/* cercas */}
                {cercaIdx.map(i => {
                  const a = svg.V[i], b = svg.V[(i + 1) % svg.V.length];
                  return <line key={i} x1={svg.sx(a.x)} y1={svg.sy(a.y)} x2={svg.sx(b.x)} y2={svg.sy(b.y)}
                    stroke="#1f6feb" strokeWidth={1.1} strokeLinecap="round" />;
                })}
                {cro.consorcio.map((p, i) => <circle key={'c' + i} cx={svg.sx(p.x).toFixed(2)} cy={svg.sy(p.y).toFixed(2)} r={0.5} fill="#7c3aed" opacity={0.9} />)}
                {cro.covas.map((p, i) => <circle key={'p' + i} cx={svg.sx(p.x).toFixed(2)} cy={svg.sy(p.y).toFixed(2)} r={0.75} fill={cor} />)}
              </svg>
            </div>
          )}

          {/* Contagem */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
              <p className="text-[16px] font-black leading-none" style={{ color: cor }}>{cro.covas.length}</p>
              <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">covas {culturaNome}</p>
            </div>
            <div className="rounded-xl py-2 text-center" style={{ background: temConsorcio ? '#7c3aed14' : 'hsl(150 15% 95%)' }}>
              <p className="text-[16px] font-black leading-none" style={{ color: temConsorcio ? '#7c3aed' : 'var(--muted-foreground)' }}>{temConsorcio ? cro.consorcio.length : '—'}</p>
              <p className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">consórcio</p>
            </div>
            <div className="rounded-xl py-2 text-center" style={{ background: `${cor}0f` }}>
              <p className="text-[16px] font-black leading-none" style={{ color: cor }}>{cro.covas.length ? Math.round(cro.covas.length / (cro.area || 1)) : 0}</p>
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

          {/* Consórcio */}
          <div className="rounded-xl p-3" style={{ background: '#7c3aed0a', border: '1px solid #7c3aed22' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={temConsorcio} onChange={e => setTemConsorcio(e.target.checked)} />
              <span className="text-[12px] font-bold text-foreground flex items-center gap-1"><Sprout size={13} style={{ color: '#7c3aed' }} /> Consorciar outro cultivo nas entrelinhas</span>
            </label>
            {temConsorcio && (
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Cultivo</label>
                  <input value={consorcioNome} onChange={e => setConsorcioNome(e.target.value)} className={inputCls} style={{ borderColor: '#7c3aed40' }} />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Espaç. na linha (m)</label>
                  <input type="number" step="0.5" min="0.5" value={consorcioDx} onChange={e => setConsorcioDx(e.target.value)} className={inputCls} style={{ borderColor: '#7c3aed40' }} />
                </div>
              </div>
            )}
          </div>

          <p className="text-[9.5px] text-muted-foreground/80 leading-tight">
            Grade geométrica cheia — se deixar carreador/bordadura, o número real cai um pouco. Confira sempre o rótulo/manejo da cultura.
          </p>
        </div>

        <div className="p-3 border-t border-border flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button onClick={baixar} disabled={baixando || !cro.covas.length}
            className="w-full py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: cor }}>
            {baixando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Baixar croqui (KML — {cro.covas.length}{temConsorcio ? ` + ${cro.consorcio.length}` : ''} covas)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
