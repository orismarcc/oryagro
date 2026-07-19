import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ArrowRight } from 'lucide-react';
import { supabase, getUserId } from '../lib/supabase';
import { createPropriedade } from '../hooks/useSupabaseSync';

export default function MigrationWizard({ onComplete }) {
  const [nome, setNome]     = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);

    const prop = await createPropriedade({ nome: nome.trim() });
    if (!prop) { setSaving(false); return; }

    const userId = await getUserId();
    if (userId) {
      await Promise.all([
        supabase.from('plantios').update({ propriedade_id: prop.id }).eq('user_id', userId).is('propriedade_id', null),
        supabase.from('estoque_insumos').update({ propriedade_id: prop.id }).eq('user_id', userId).is('propriedade_id', null),
      ]);
    }

    setSaving(false);
    onComplete(prop);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{ background: '#fff' }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'hsl(157 68% 26% / 0.1)' }}>
            <Building2 size={28} style={{ color: 'hsl(157 68% 26%)' }} />
          </div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Organize seus lotes</h2>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
            O OryAgro agora organiza lotes e estoque por <strong>propriedade</strong>.
            Dê um nome para sua propriedade principal — todos os seus dados serão migrados automaticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Nome da propriedade (ex: Sítio Portuga)"
            required autoFocus
            className="w-full px-4 py-3 rounded-2xl text-[14px] font-semibold outline-none"
            style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 88%)' }}
          />
          <button
            type="submit" disabled={saving || !nome.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: 'hsl(157 68% 26%)' }}
          >
            {saving ? 'Migrando…' : <><span>Continuar</span><ArrowRight size={16} /></>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
