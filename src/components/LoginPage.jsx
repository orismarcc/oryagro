import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Sprout, Mail, Lock, AlertCircle, CheckCircle2, UserPlus, LogIn, Eye, EyeOff, User } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode]           = useState('login'); // 'login' | 'signup'
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const reset = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setDisplayName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'signup') {
      if (!displayName.trim() || displayName.trim().length < 2) {
        setError('Informe seu nome (mínimo 2 caracteres).');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirm) {
        setError('As senhas não coincidem.');
        return;
      }
    }

    setLoading(true);

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(
          err.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.'
            : err.message === 'Email not confirmed'
            ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
            : err.message,
        );
      }
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (err) {
        setError(
          err.message.includes('already registered')
            ? 'Este e-mail já possui uma conta. Faça login.'
            : err.message,
        );
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.');
        setMode('login');
        setPassword('');
        setConfirm('');
      }
    }

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

        {/* pt combina safe-area + espaçamento: env() é 0 no web, status-bar height no APK */}
        <div className="relative z-10 px-6 pb-10 text-center" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
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
            <p className="text-white/55 text-sm mt-1">Guia Hortícola — Mato Grosso</p>
          </motion.div>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="px-6 pt-6 max-w-sm mx-auto w-full">
        <div className="flex rounded-2xl p-1 gap-1" style={{ background: 'hsl(210 16% 95%)' }}>
          {[
            { key: 'login',  label: 'Entrar',       Icon: LogIn },
            { key: 'signup', label: 'Criar conta',  Icon: UserPlus },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => reset(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
              style={mode === key
                ? { background: 'white', color: 'hsl(160 84% 27%)', boxShadow: '0 1px 4px rgb(0 0 0 / 0.10)' }
                : { color: 'hsl(215 16% 50%)' }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <div className="flex-1 flex flex-col justify-start px-6 pt-5 pb-10 max-w-sm mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-0.5">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </h2>
            <p className="text-[13px] text-muted-foreground mb-5">
              {mode === 'login'
                ? 'Acesse com seu e-mail e senha'
                : 'Preencha os dados para criar sua conta'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome — signup only */}
              {mode === 'signup' && (
                <Field label="Nome">
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      minLength={2}
                      className="w-full pl-9 pr-3 py-3 rounded-xl text-[14px] outline-none"
                      style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
                    />
                  </div>
                </Field>
              )}

              {/* Email */}
              <Field label="E-mail">
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-9 pr-3 py-3 rounded-xl text-[14px] outline-none"
                    style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
                  />
                </div>
              </Field>

              {/* Password */}
              <Field label={mode === 'signup' ? 'Senha (mín. 6 caracteres)' : 'Senha'}>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-9 py-3 rounded-xl text-[14px] outline-none"
                    style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              {/* Confirm password — signup only */}
              {mode === 'signup' && (
                <Field label="Confirmar senha">
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-3 py-3 rounded-xl text-[14px] outline-none"
                      style={{ background: 'hsl(210 16% 96%)', border: '1.5px solid hsl(214 20% 88%)', color: 'hsl(215 20% 16%)' }}
                    />
                  </div>
                </Field>
              )}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: 'hsl(4 80% 96%)', border: '1px solid #fca5a5' }}
                  >
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                    <p className="text-[12px] font-medium" style={{ color: '#dc2626' }}>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: 'hsl(152 60% 95%)', border: '1px solid #6ee7b7' }}
                  >
                    <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#059669' }} />
                    <p className="text-[12px] font-medium" style={{ color: '#059669' }}>{success}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading || !email || !password || (mode === 'signup' && (!confirm || displayName.trim().length < 2))}
                className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'hsl(160 84% 27%)' }}
              >
                {loading
                  ? (mode === 'login' ? 'Entrando…' : 'Criando conta…')
                  : (mode === 'login' ? 'Entrar' : 'Criar conta')}
              </button>
            </form>

            <p className="text-center text-[11px] text-muted-foreground mt-5">
              {mode === 'login'
                ? <>Não tem conta?{' '}
                    <button onClick={() => reset('signup')} className="font-semibold underline">Criar conta</button>
                  </>
                : <>Já tem conta?{' '}
                    <button onClick={() => reset('login')} className="font-semibold underline">Entrar</button>
                  </>
              }
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
