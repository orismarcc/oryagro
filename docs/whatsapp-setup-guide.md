# 📱 Guia de Configuração — Alertas via WhatsApp (OryAgro)

O sistema está pronto para enviar notificações via WhatsApp. Você só precisa escolher
e configurar **um dos providers** abaixo e inserir as credenciais em
**Configurações → Notificações WhatsApp** no app.

---

## Providers Disponíveis

### 🥇 Opção Recomendada: Z-API (mais fácil para brasileiros)

**O que é:** Z-API conecta ao WhatsApp do seu próprio celular — não precisa de plano empresarial.

**Passos:**
1. Acesse https://z-api.io e crie uma conta gratuita
2. Crie uma nova instância ("Criar instância")
3. Escaneie o QR Code com o WhatsApp do número que vai enviar as mensagens
4. No painel da instância, copie:
   - **Instance ID** (ex: `3F1B2C4D5E6...`) → coloca em `API Key / Instance ID`
   - **Token** (ex: `F7AB8C9D0E1...`) → coloca em `API Secret / Token`
5. Em **Número de destino**, coloque o número que vai RECEBER as mensagens
   - Formato: `5566999999999` (código país + DDD + número, sem símbolos)
6. Clique em **Salvar** e depois em **Testar envio**

**Plano gratuito:** até 100 mensagens/mês  
**Custo pago:** ~R$ 30/mês para mensagens ilimitadas

---

### Opção 2: Twilio (mais robusto, requer aprovação)

**O que é:** Plataforma empresarial global, mais confiável mas requer aprovação para usar o WhatsApp Business.

**Passos:**
1. Acesse https://www.twilio.com e crie uma conta
2. Ative o WhatsApp Sandbox (para testes) ou solicite aprovação de número Business
3. No painel Twilio, copie:
   - **Account SID** → coloca em `API Key / Instance ID`
   - **Auth Token** → coloca em `API Secret / Token`
   - **Número do remetente** (ex: `+14155238886`) → coloca em `Número de envio (FROM)`
4. Em **Número de destino**, coloque o número que vai receber

**Custo:** ~$0.005/mensagem (centavos por mensagem)

---

### Opção 3: Evolution API (gratuito, técnico)

**O que é:** Solução open-source self-hosted. Você mesmo hospeda o servidor.

**Necessário:** Um servidor VPS (ex: DigitalOcean, Hetzner) com Docker

**Passos:**
1. Instale via Docker: https://github.com/EvolutionAPI/evolution-api
2. Crie uma instância e conecte o WhatsApp
3. Em `API Key / Instance ID`, coloque a URL do seu servidor (ex: `https://meu-servidor.com`)
4. Em `API Secret / Token`, coloque a API Key da instância
5. Em `Número de envio (FROM)`, coloque o nome da instância criada

**Custo:** Apenas custo do servidor (~R$ 15/mês no Hetzner)

---

### Opção 4: WhatsApp Cloud API (Meta Business, oficial)

**O que é:** API oficial do WhatsApp/Meta. Requer conta Business e aprovação.

**Passos:**
1. Crie conta em https://developers.facebook.com
2. Crie um app Business e ative o produto "WhatsApp"
3. Adicione um número de telefone e faça a verificação
4. Copie:
   - **Phone Number ID** → coloca em `API Key / Instance ID`
   - **Access Token** (permanente) → coloca em `API Secret / Token`
5. Configure o **número de destino** que vai receber

**Custo:** Gratuito para primeiras 1000 conversas/mês, depois ~$0.05 por conversa

---

## Configurações de Alerta

No app, você pode ativar/desativar cada tipo de alerta:

| Alerta | O que envia |
|--------|-------------|
| 🌱 Cronograma | Etapas previstas nos próximos N dias |
| 🌾 Colheita | Quando um lote está pronto para colheita há mais de 2 dias |
| 💰 Cobranças | Parcelas que vencem em 3 dias ou já vencidas |
| 📦 Estoque | Insumos com menos de 7 dias de consumo restante |

**Antecedência:** Quantos dias antes o alerta é enviado (padrão: 1 dia)

---

## Após configurar

1. **Salve** as credenciais no app
2. Clique em **"Testar envio"** — você deve receber uma mensagem de teste no número configurado
3. Se o teste funcionar, ative os tipos de alerta desejados
4. Os alertas são verificados **automaticamente** sempre que você abre o app

---

## Suporte

Se precisar de ajuda para configurar, entre em contato:
- Email: suporte@oryagro.com
- WhatsApp: (66) 9999-9999 (ironicamente 😄)
