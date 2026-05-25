import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User, Lock, Bell, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Toggle (disabled placeholder) ────────────────────────────────────────────

function Toggle({ label, description }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[13px] font-semibold text-foreground opacity-50">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 opacity-50">{description}</p>
        )}
      </div>
      <div
        className="w-10 h-6 rounded-full flex-shrink-0 relative opacity-40 cursor-not-allowed"
        style={{ background: 'hsl(214 20% 88%)' }}
      >
        <div
          className="absolute top-1 left-1 w-4 h-4 rounded-full"
          style={{ background: 'white', boxShadow: '0 1px 3px rgb(0 0 0 / 0.15)' }}
        />
      </div>
    </div>
  );
}

// ── Inline message ────────────────────────────────────────────────────────────

function InlineMsg({ msg }) {
  if (!msg) return null;
  const isSuccess = msg.type === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
      style={{
        background: isSuccess ? 'hsl(152 60% 95%)' : 'hsl(4 80% 96%)',
        border: `1px solid ${isSuccess ? '#6ee7b7' : '#fca5a5'}`,
      }}
    >
      {isSuccess
        ? <CheckCircle2 size={13} style={{ color: '#059669' }} className="flex-shrink-0" />
        : <AlertCircle  size={13} style={{ color: '#dc2626' }} className="flex-shrink-0" />}
      <p className="text-[12px] font-medium" style={{ color: isSuccess ? '#059669' : '#dc2626' }}>
        {msg.text}
      </p>
    </motion.div>
  );
}

// ── PerfilSection ─────────────────────────────────────────────────────────────

function PerfilSection() {
  const [userEmail, setUserEmail]         = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [nameLoading, setNameLoading]     = useState(false);
  const [nameMsg, setNameMsg]             = useState(null);

  const [currentPass, setCurrentPass]     = useState('');
  const [newPass, setNewPass]             = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [passLoading, setPassLoading]     = useState(false);
  const [passMsg, setPassMsg]             = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
      setDisplayName(
        user?.user_metadata?.display_name?.trim() ||
        user?.email?.split('@')[0] ||
        ''
      );
    });
  }, []);

  // ── Save display name ──────────────────────────────────────────────────────

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length < 2) return;
    setNameLoading(true);
    setNameMsg(null);

    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (error) {
      setNameMsg({ type: 'error', text: 'Ocorreu um erro ao salvar. Tente novamente.' });
      setNameLoading(false);
      return;
    }

    // Mirror to profiles table so farm member lookups stay in sync
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ display_name: trimmed }).eq('id', user.id);
    }

    setNameMsg({ type: 'success', text: 'Nome atualizado com sucesso' });
    setNameLoading(false);
  };

  // ── Change password ────────────────────────────────────────────────────────

  const handleChangePass = async (e) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPass.length < 8) {
      setPassMsg({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    setPassLoading(true);

    // Verify current password by attempting sign-in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPass,
    });
    if (signInErr) {
      setPassMsg({ type: 'error', text: 'Senha atual incorreta' });
      setPassLoading(false);
      return;
    }

    // Update to new password (session remains active)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
    if (updateErr) {
      setPassMsg({ type: 'error', text: 'Ocorreu um erro ao salvar. Tente novamente.' });
    } else {
      setPassMsg({ type: 'success', text: 'Senha alterada com sucesso' });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    }

    setPassLoading(false);
  };

  const nameValid = displayName.trim().length >= 2;

  return (
    <div className="space-y-5">

      {/* ── Nome ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} style={{ color: 'hsl(160 84% 27%)' }} />
          <p className="text-[14px] font-bold text-foreground">Nome</p>
        </div>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Nome de exibição
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameMsg(null); }}
              required
              minLength={2}
              className="w-full px-3 py-3 rounded-xl text-[14px] outline-none"
              style={{
                background: 'hsl(210 16% 96%)',
                border: '1.5px solid hsl(214 20% 88%)',
                color: 'hsl(215 20% 16%)',
              }}
            />
          </div>
          {userEmail && (
            <p className="text-[11px] text-muted-foreground px-0.5">
              E-mail: {userEmail}
            </p>
          )}
          <AnimatePresence>{nameMsg && <InlineMsg msg={nameMsg} />}</AnimatePresence>
          <button
            type="submit"
            disabled={nameLoading || !nameValid}
            className="w-full py-3 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'hsl(160 84% 27%)' }}
          >
            {nameLoading ? 'Salvando…' : 'Salvar nome'}
          </button>
        </form>
      </div>

      {/* ── Senha ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} style={{ color: 'hsl(160 84% 27%)' }} />
          <p className="text-[14px] font-bold text-foreground">Alterar Senha</p>
        </div>
        <form onSubmit={handleChangePass} className="space-y-3">
          {[
            { label: 'Senha atual',         value: currentPass,  setter: setCurrentPass,  placeholder: '••••••••' },
            { label: 'Nova senha (mín. 8 caracteres)', value: newPass,      setter: setNewPass,      placeholder: '••••••••' },
            { label: 'Confirmar nova senha', value: confirmPass,  setter: setConfirmPass,  placeholder: '••••••••' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={value}
                  onChange={e => { setter(e.target.value); setPassMsg(null); }}
                  placeholder={placeholder}
                  required
                  className="w-full pl-3 pr-9 py-3 rounded-xl text-[14px] outline-none"
                  style={{
                    background: 'hsl(210 16% 96%)',
                    border: '1.5px solid hsl(214 20% 88%)',
                    color: 'hsl(215 20% 16%)',
                  }}
                />
                {label === 'Senha atual' && (
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <AnimatePresence>{passMsg && <InlineMsg msg={passMsg} />}</AnimatePresence>
          <button
            type="submit"
            disabled={passLoading || !currentPass || !newPass || !confirmPass}
            className="w-full py-3 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'hsl(160 84% 27%)' }}
          >
            {passLoading ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── NotificacoesSection ───────────────────────────────────────────────────────

function NotificacoesSection() {
  const toggles = [
    { label: 'Notificações por e-mail',           description: 'Receba atualizações importantes por e-mail' },
    { label: 'Alertas de cronograma',             description: 'Avisos sobre etapas pendentes ou atrasadas' },
    { label: 'Resumo semanal da propriedade',     description: 'Relatório automático toda segunda-feira' },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={15} style={{ color: 'hsl(160 84% 27%)' }} />
          <p className="text-[14px] font-bold text-foreground">Notificações</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'hsl(214 20% 92%)' }}>
          {toggles.map(t => <Toggle key={t.label} {...t} />)}
        </div>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
        style={{ background: 'hsl(210 16% 96%)', border: '1px solid hsl(214 20% 90%)' }}
      >
        <span className="text-base leading-none flex-shrink-0 mt-0.5">🔔</span>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          As notificações serão disponibilizadas em breve.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'perfil',        label: 'Perfil' },
  { key: 'notificacoes',  label: 'Notificações' },
];

export default function SettingsPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('perfil');

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="gradient-hero px-5 pb-5" style={{ paddingTop: 'var(--hero-pad-top)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/60 text-[12px] font-medium mb-4 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Início
        </button>
        <h1 className="font-display text-white text-2xl font-extrabold leading-tight">
          Configurações
        </h1>
        <p className="text-white/50 text-[12px] mt-1">Perfil e preferências da conta</p>

        {/* Tab pills */}
        <div className="flex gap-1.5 mt-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="text-[12px] font-bold px-4 py-1.5 rounded-full transition-all"
              style={activeTab === tab.key
                ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'perfil'       && <PerfilSection />}
            {activeTab === 'notificacoes' && <NotificacoesSection />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
