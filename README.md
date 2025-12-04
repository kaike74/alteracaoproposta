# Alteração de Proposta - E-MÍDIAS

Sistema de gestão de propostas da HUB RÁDIOS com integração ao Notion e envio de notificações por email via Gmail API.

## Migração Resend → Gmail API

Este projeto foi migrado do serviço Resend para a **Gmail API** usando autenticação via Service Account do Google Cloud.

### Características da Implementação

- ✅ Autenticação JWT com Google Cloud Service Account
- ✅ Envio de emails via Gmail API
- ✅ Impersonation: emails enviados como `emidias@hubradios.com`
- ✅ Destinatários fixos: `kaike@hubradios.com` e `dani@hubradios.com`
- ✅ Formato HTML preservado dos emails
- ✅ Logs detalhados de debug
- ✅ Zero dependência do Resend

## Configuração de Variáveis de Ambiente

### Variáveis Necessárias no Cloudflare Pages

Configure as seguintes variáveis de ambiente no painel do Cloudflare Pages:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `NOTION_TOKEN` | `secret_...` | Token de integração do Notion |
| `GMAIL_CLIENT_EMAIL` | `importaleads@gen-lang-client-0872420564.iam.gserviceaccount.com` | Email da Service Account do Google Cloud |
| `GMAIL_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Chave privada da Service Account (com `\n` para quebras de linha) |

### Como Configurar no Cloudflare Pages

1. Acesse o painel do Cloudflare Pages
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione as três variáveis acima
5. **IMPORTANTE**: Para `GMAIL_PRIVATE_KEY`, certifique-se de incluir a chave completa com `\n` para quebras de linha

### Credenciais do Google Cloud

**Service Account**: `importaleads@gen-lang-client-0872420564.iam.gserviceaccount.com`
**Project ID**: `gen-lang-client-0872420564`
**Scope necessário**: `https://www.googleapis.com/auth/gmail.send`

### Configuração de Domain-Wide Delegation (Impersonation)

Para que o envio funcione via `emidias@hubradios.com`, você precisa configurar Domain-Wide Delegation no Google Workspace:

1. Acesse o [Google Admin Console](https://admin.google.com)
2. Vá em **Security** → **API Controls** → **Domain-wide Delegation**
3. Adicione a Service Account com o Client ID: `107517427027189588066`
4. Adicione o scope: `https://www.googleapis.com/auth/gmail.send`
5. Autorize o acesso

**IMPORTANTE**: Sem esta configuração, o envio de emails falhará com erro de permissão.

## Endpoints da API

### `/api/test`
Endpoint de teste básico para verificar se a API está funcionando.

**Resposta**:
```json
{
  "status": "ok",
  "message": "API funcionando",
  "timestamp": "2025-12-04T..."
}
```

### `/api/test-email`
Endpoint para verificar se as credenciais do Gmail estão configuradas corretamente.

**Resposta**:
```json
{
  "status": "ok",
  "message": "Teste de configuração Gmail API",
  "gmailClientEmailExists": true,
  "gmailPrivateKeyExists": true,
  "gmailClientEmail": "importaleads@gen-lang-client-0872420564.iam.gserviceaccount.com",
  "gmailPrivateKeyPreview": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG...",
  "configurationStatus": "CONFIGURADO",
  "timestamp": "2025-12-04T..."
}
```

## Estrutura do Projeto

```
alteracaoproposta/
├── functions/
│   ├── notion.js          # API Gateway do Notion + Função de envio de email via Gmail
│   └── test.js            # Endpoints de teste
├── public/
│   └── script.js          # Frontend
├── index.html             # Página principal
├── wrangler.toml          # Configuração do Cloudflare Pages
└── README.md              # Este arquivo
```

## Detalhes Técnicos da Implementação

### Autenticação JWT

A autenticação é feita em duas etapas:

1. **Criação do JWT Token**: Assinado com a chave privada da Service Account usando algoritmo RS256
2. **Troca por Access Token**: JWT é trocado por um access token válido via Google OAuth2

### Envio de Email

O email é enviado via Gmail API no formato RFC 2822:
- Codificação: base64url
- Content-Type: text/html; charset=utf-8
- Endpoint: `https://www.googleapis.com/gmail/v1/users/emidias@hubradios.com/messages/send`

### Logs de Debug

Todos os emails incluem logs detalhados:
- Status de autenticação
- Access token obtido
- Preparação da mensagem
- Status do envio
- Erros (se houver)

## Troubleshooting

### Erro: "Error getting delegated credentials"

**Causa**: Domain-Wide Delegation não configurado ou configurado incorretamente.

**Solução**:
1. Verifique se a Service Account está autorizada no Google Admin Console
2. Confirme que o scope `https://www.googleapis.com/auth/gmail.send` está adicionado
3. Aguarde até 24 horas para propagação (normalmente é instantâneo)

### Erro: "Invalid grant"

**Causa**: Chave privada inválida ou mal formatada.

**Solução**:
1. Verifique se a variável `GMAIL_PRIVATE_KEY` contém `\n` para quebras de linha
2. Confirme que a chave completa está presente (incluindo BEGIN e END)
3. Teste com `/api/test-email` para verificar a configuração

### Erro: "Insufficient permissions"

**Causa**: Service Account não tem permissão para impersonar o usuário.

**Solução**:
1. Verifique se Domain-Wide Delegation está configurado
2. Confirme que o email `emidias@hubradios.com` existe no Google Workspace
3. Verifique se o scope está correto

## Histórico de Alterações

### v2.0.0 - Migração para Gmail API (2025-12-04)

- ✅ Removida dependência do Resend
- ✅ Implementada autenticação JWT com Google Cloud
- ✅ Adicionado suporte a impersonation via Gmail API
- ✅ Destinatários atualizados para kaike@hubradios.com e dani@hubradios.com
- ✅ Logs de debug aprimorados
- ✅ Endpoint de teste atualizado

## Suporte

Para questões ou problemas, entre em contato com a equipe de desenvolvimento da HUB RÁDIOS.

---

© 2025 HUB RÁDIOS - E-MÍDIAS. Todos os direitos reservados.
