/**
 * useWhatsApp.js — Framework de notificações via WhatsApp
 *
 * Arquitetura:
 * 1. Usuário configura provider + credenciais em SettingsPage
 * 2. Config é salva em whatsapp_config (Supabase, criptografado pelo servidor)
 * 3. sendWhatsApp() monta e envia a mensagem via API do provider escolhido
 * 4. Cada envio é logado em whatsapp_notificacoes para histórico
 *
 * Providers suportados (a serem ativados com as credenciais):
 *   - twilio       : Twilio WhatsApp Business API
 *   - z-api        : Z-API (popular no Brasil, direto do número pessoal)
 *   - evolution    : Evolution API (self-hosted)
 *   - whatsapp-web : WhatsApp Cloud API (Meta Business)
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/logger';

// ── CRUD config ───────────────────────────────────────────────────────────────

export async function loadWhatsAppConfig() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) { logDbError('loadWhatsAppConfig', error); return null; }
  return data;
}

export async function saveWhatsAppConfig(config) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('whatsapp_config')
    .upsert({ ...config, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) { logDbError('saveWhatsAppConfig', error); return null; }
  return data;
}

// ── Envio de mensagem ─────────────────────────────────────────────────────────

/**
 * Envia mensagem via WhatsApp de acordo com o provider configurado.
 * Retorna { ok: boolean, error?: string }
 */
export async function sendWhatsApp({ config, mensagem, tipo, plantioId }) {
  if (!config?.enabled) return { ok: false, error: 'WhatsApp não habilitado' };
  if (!config?.to_number) return { ok: false, error: 'Número de destino não configurado' };

  let result = { ok: false, error: 'Provider não implementado' };

  try {
    switch (config.provider) {

      case 'twilio': {
        // Twilio WhatsApp API
        // Docs: https://www.twilio.com/docs/whatsapp/quickstart
        if (!config.api_key || !config.api_secret || !config.from_number)
          return { ok: false, error: 'Twilio: configure Account SID, Auth Token e número From' };

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.api_key}/Messages.json`;
        const body = new URLSearchParams({
          From: `whatsapp:${config.from_number}`,
          To:   `whatsapp:${config.to_number}`,
          Body: mensagem,
        });
        const resp = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${config.api_key}:${config.api_secret}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        result = resp.ok ? { ok: true } : { ok: false, error: `Twilio ${resp.status}: ${await resp.text()}` };
        break;
      }

      case 'z-api': {
        // Z-API — https://developer.z-api.io/
        // instance_id = api_key, token = api_secret
        if (!config.api_key || !config.api_secret)
          return { ok: false, error: 'Z-API: configure Instance ID e Token' };

        const numero = config.to_number.replace(/\D/g, '');
        const zapiUrl = `https://api.z-api.io/instances/${config.api_key}/token/${config.api_secret}/send-text`;
        const resp = await fetch(zapiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: numero, message: mensagem }),
        });
        result = resp.ok ? { ok: true } : { ok: false, error: `Z-API ${resp.status}` };
        break;
      }

      case 'evolution': {
        // Evolution API (self-hosted)
        // api_key = URL da instância, api_secret = API Key
        if (!config.api_key || !config.api_secret)
          return { ok: false, error: 'Evolution API: configure URL e API Key' };

        const numero = config.to_number.replace(/\D/g, '');
        const instanceName = config.from_number || 'default';
        const resp = await fetch(`${config.api_key}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': config.api_secret },
          body: JSON.stringify({ number: numero, textMessage: { text: mensagem } }),
        });
        result = resp.ok ? { ok: true } : { ok: false, error: `Evolution ${resp.status}` };
        break;
      }

      case 'whatsapp-cloud': {
        // Meta WhatsApp Cloud API
        // api_key = Phone Number ID, api_secret = Access Token
        if (!config.api_key || !config.api_secret)
          return { ok: false, error: 'WhatsApp Cloud: configure Phone Number ID e Access Token' };

        const numero = config.to_number.replace(/\D/g, '');
        const resp = await fetch(`https://graph.facebook.com/v19.0/${config.api_key}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.api_secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: numero,
            type: 'text',
            text: { body: mensagem },
          }),
        });
        result = resp.ok ? { ok: true } : { ok: false, error: `WhatsApp Cloud ${resp.status}` };
        break;
      }

      default:
        result = { ok: false, error: `Provider desconhecido: ${config.provider}` };
    }
  } catch (e) {
    result = { ok: false, error: String(e?.message || e) };
  }

  // Logar tentativa de envio
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('whatsapp_notificacoes').insert({
        user_id:    user.id,
        tipo,
        plantio_id: plantioId || null,
        mensagem,
        status:     result.ok ? 'sent' : 'failed',
        enviado_em: result.ok ? new Date().toISOString() : null,
        erro:       result.error || null,
      });
    }
  } catch { /* log failure should not break the main flow */ }

  return result;
}

// ── Gerador de mensagens ──────────────────────────────────────────────────────

export function gerarMensagemCronograma({ loteName, etapa, data, diasRestantes }) {
  const d = new Date(data + 'T12:00:00');
  const dataFormatada = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  const urgencia = diasRestantes === 0 ? ' *HOJE!*' : diasRestantes === 1 ? ' amanhã' : ` em ${diasRestantes} dias`;
  return [
    `🌱 *OryAgro — Lembrete de Atividade*`,
    ``,
    `📋 *Lote:* ${loteName}`,
    `📌 *Etapa:* ${etapa}`,
    `📅 *Data prevista:* ${dataFormatada}${urgencia}`,
    ``,
    `Acesse o OryAgro para registrar a atividade.`,
    `https://oryagro.vercel.app`,
  ].join('\n');
}

export function gerarMensagemColheita({ loteName, diasPronta }) {
  return [
    `🌾 *OryAgro — Colheita Pronta!*`,
    ``,
    `✅ O lote *${loteName}* está pronto para colheita há ${diasPronta} dia(s).`,
    ``,
    `Registre a colheita no app para manter seu histórico atualizado.`,
    `https://oryagro.vercel.app`,
  ].join('\n');
}

export function gerarMensagemCobranca({ compradorNome, valor, dataVencimento, diasRestantes }) {
  const venc = new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR');
  const urgencia = diasRestantes <= 0
    ? `*VENCIDA há ${Math.abs(diasRestantes)} dia(s)!*`
    : `vence em *${diasRestantes} dia(s)* (${venc})`;
  return [
    `💰 *OryAgro — Cobrança${diasRestantes <= 0 ? ' Vencida' : ' Próxima'}*`,
    ``,
    `👤 *Comprador:* ${compradorNome}`,
    `💵 *Valor:* R$ ${Number(valor).toFixed(2).replace('.', ',')}`,
    `📅 Parcela ${urgencia}`,
    ``,
    `Acesse o OryAgro para gerenciar cobranças.`,
    `https://oryagro.vercel.app`,
  ].join('\n');
}

export function gerarMensagemEstoque({ insumoNome, quantidade, unidade, diasRestantes }) {
  return [
    `⚠️ *OryAgro — Alerta de Estoque*`,
    ``,
    `📦 *Insumo:* ${insumoNome}`,
    `📊 *Quantidade atual:* ${quantidade} ${unidade}`,
    `⏳ *Estimativa:* acaba em ~${diasRestantes} dias`,
    ``,
    `Planeje a recompra para não interromper as atividades.`,
    `https://oryagro.vercel.app`,
  ].join('\n');
}

// ── Hook React ────────────────────────────────────────────────────────────────

export function useWhatsAppConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWhatsAppConfig().then(c => {
      setConfig(c ?? {
        provider: 'z-api',
        enabled: false,
        to_number: '',
        notif_cronograma: true,
        notif_colheita: true,
        notif_cobranças: true,
        notif_estoque: true,
        antecedencia_dias: 1,
      });
      setLoading(false);
    });
  }, []);

  const save = async (updates) => {
    setSaving(true);
    const saved = await saveWhatsAppConfig({ ...(config || {}), ...updates });
    if (saved) setConfig(saved);
    setSaving(false);
    return !!saved;
  };

  return { config, loading, saving, save, setConfig };
}
