import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Sprout, Mail, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Hero ── */}
      <div className="gradient-hero relative overflow-hidden flex-shrink-0">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div className="absolute right-5 bottom-0 pointer-events-none select-none opacity-[0.05]">
          <Sprout size={130} color="white" />
        </div>

        <div className="relative z-10 px-6 pt-16 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 border"
              style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.28)' }}>
              <Sprout size={28} color="white" />
            </div>
            <h1 className="font-display text-white text-3xl font-extrabold leading-tight">OryAgro</h1>
            <p className="text-white/55 text-sm mt-1">Guia Hortícola</p>
          </motion.div>
        </div>
      </div>

      {/* ── Login form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-sm mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-display text-xl font-bold text-foreground mb-1">Bem-vindo</h2>
          <p className="text-[13px] text-muted-foreground mb-6">Acesse com sua conta para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-9 pr-3 py-3 rounded-xl text-[14px] outline-none transition-all"
                  style={{
                    background: 'hsl(210 16% 96%)',
                    border: '1.5px solid hsl(214 20% 88%)',
                    color: 'hsl(215 20% 16%)',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-3 py-3 rounded-xl text-[14px] outline-none"
                  style={{
                    background: 'hsl(210 16% 96%)',
                    border: '1.5px solid hsl(214 20% 88%)',
                    color: 'hsl(215 20% 16%)',
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'hsl(4 80% 96%)', border: '1px solid #fca5a5' }}
              >
                <AlertCircle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                <p className="text-[12px] font-medium" style={{ color: '#dc2626' }}>
                  {error === 'Invalid login credentials'
                    ? 'E-mail ou senha incorretos'
                    : error}
                </p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'hsl(160 84% 27%)' }}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            Acesso restrito ao time OryAgro
          </p>
        </motion.div>
      </div>
    </div>
  );
}
