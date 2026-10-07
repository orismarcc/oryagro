/**
 * MaisPage.jsx — tudo o que não é do dia a dia, num lugar só.
 * Substitui o menu hambúrguer e a aba "Propriedades" da barra inferior.
 */
import React from 'react';
import {
  Building2, Wallet, Users, BarChart2, TrendingUp, Calculator, Settings, LogOut, ChevronRight, Scale,
} from 'lucide-react';
import Logo from './Logo';

const BRAND = 'hsl(156 64% 31%)';

export default function MaisPage({ onNavigate, onSignOut, isGlobalAdmin = true, userName }) {
  const grupos = [
    {
      titulo: 'Fazenda',
      itens: [
        { id: 'propriedades', Icon: Building2, lbl: 'Propriedades e talhões', sub: 'Áreas, mapas, equipe' },
      ],
    },
    {
      titulo: 'Dinheiro',
      itens: [
        isGlobalAdmin && { id: 'financeiro', Icon: Wallet, lbl: 'Financeiro', sub: 'Receitas, despesas e relatórios' },
        isGlobalAdmin && { id: 'compradores', Icon: Users, lbl: 'Compradores e vendas', sub: 'Vendas e parcelas a receber' },
        isGlobalAdmin && { id: 'analise', Icon: BarChart2, lbl: 'Análise', sub: 'Desempenho dos lotes' },
      ].filter(Boolean),
    },
    {
      titulo: 'Planejar',
      itens: [
        { id: 'simulador', Icon: TrendingUp, lbl: 'Simulador', sub: 'Quanto custa e quanto rende uma cultura' },
        { id: 'comparacao', Icon: Scale, lbl: 'Comparar culturas', sub: 'Lado a lado' },
        { id: 'calculadora', Icon: Calculator, lbl: 'Calculadora de insumos', sub: 'Doses por área e por planta' },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { id: 'configuracoes', Icon: Settings, lbl: 'Configurações', sub: 'Perfil e notificações' },
      ],
    },
  ].filter(g => g.itens.length);

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero px-5 pb-6" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <div className="flex items-center gap-3">
          <Logo size={38} style={{ borderRadius: 10 }} />
          <div>
            <p className="text-white text-[18px] font-black leading-tight">Mais</p>
            {userName && <p className="text-white/60 text-[12px]">{userName}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-2xl mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }}>
        {grupos.map(g => (
          <div key={g.titulo} className="mb-5">
            <p className="section-label mb-2 px-1">{g.titulo}</p>
            <div className="card overflow-hidden">
              {g.itens.map((it, i) => (
                <button key={it.id} onClick={() => onNavigate(it.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.02]"
                  style={{ borderBottom: i < g.itens.length - 1 ? '1px solid hsl(140 13% 93%)' : 'none' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(156 40% 94%)' }}>
                    <it.Icon size={17} style={{ color: BRAND }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-foreground">{it.lbl}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{it.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {onSignOut && (
          <button onClick={() => { if (window.confirm('Sair da conta?')) onSignOut(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-bold"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <LogOut size={15} /> Sair
          </button>
        )}
      </div>
    </div>
  );
}
