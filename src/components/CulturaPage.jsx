import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import VisaoGeral from './VisaoGeral';
import ManejoAdubacao from './ManejoAdubacao';
import CronogramaTimeline from './CronogramaTimeline';
import SimuladorFinanceiro from './SimuladorFinanceiro';

export default function CulturaPage({ cultura }) {
  return (
    <div>
      {/* Header */}
      <div className="px-6 py-5 border-b border-borda bg-white" style={{ background: `linear-gradient(135deg, ${cultura.cor}08 0%, transparent 60%)` }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-sm" style={{ backgroundColor: cultura.cor }} />
          <div>
            <div className="text-xs text-gray-400 italic">{cultura.nomesCientifico}</div>
            <h1 className="text-2xl font-display font-bold text-gray-900 leading-tight">{cultura.nome}</h1>
            {cultura.tipo === 'campo' && (
              <span className="text-xs font-bold text-ambar-600 uppercase tracking-wide">Cultura de Campo — por hectare</span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="manejo">Manejo e Adubação</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>
        <TabsContent value="visao"><VisaoGeral cultura={cultura} /></TabsContent>
        <TabsContent value="manejo"><ManejoAdubacao cultura={cultura} /></TabsContent>
        <TabsContent value="cronograma"><CronogramaTimeline cultura={cultura} /></TabsContent>
        <TabsContent value="simulador"><SimuladorFinanceiro cultura={cultura} /></TabsContent>
      </Tabs>
    </div>
  );
}
