# E-mail transacional da Jards

> Estado: infraestrutura do MVP. Revise domínio, credenciais e limites do provedor em cada ambiente antes do deploy.

## Arquitetura

- **Supabase Auth via SMTP Resend:** confirmação de cadastro, recuperação de senha, confirmação de troca de senha e convite para membro.
- **API Resend no servidor Next.js:** eventos do produto, começando pelo aviso de pesquisa de patrocinador concluída.
- As chaves ficam somente no servidor. Nenhuma variável sensível usa o prefixo `NEXT_PUBLIC_`.

## 1. Preparar o domínio no Resend

1. Adicione um subdomínio dedicado, como `notify.jards.com.br`.
2. Publique no DNS os registros SPF e DKIM mostrados pelo Resend.
3. Configure DMARC no domínio.
4. Desative o rastreamento de links para mensagens de autenticação.

## 2. Variáveis da aplicação

Adicione ao `.env.local` e ao ambiente de produção:

```ini
RESEND_API_KEY=re_...
TRANSACTIONAL_EMAIL_FROM=Jards <notificacoes@notify.jards.com.br>
TRANSACTIONAL_EMAIL_REPLY_TO=suporte@jards.com.br
NEXT_PUBLIC_APP_URL=https://app.jards.com.br
```

Reinicie a aplicação depois de alterar as variáveis.

## 3. SMTP do Supabase hospedado

No projeto Supabase, abra **Authentication → Emails → SMTP Settings** e habilite SMTP personalizado:

```text
Host: smtp.resend.com
Porta: 465
Usuário: resend
Senha: a mesma RESEND_API_KEY
Nome do remetente: Jards
E-mail do remetente: acesso@notify.jards.com.br
```

Em **Authentication → Emails → Templates**, copie o conteúdo dos arquivos de `supabase/templates` para os templates correspondentes. Ative também a notificação de senha alterada.

Em **Authentication → URL Configuration**:

- Site URL de produção: `https://app.jards.com.br`
- Redirect URLs: inclua os domínios de produção e desenvolvimento usados nos callbacks.

Em **Authentication → Providers → Email**, mantenha a confirmação de e-mail ativada.

## 4. Testes obrigatórios

Use endereços reais diferentes e valide:

1. cadastro novo recebe confirmação e só entra depois de confirmar;
2. “esqueci minha senha” abre `/nova-senha` e permite trocar a senha;
3. senha alterada gera aviso de segurança;
4. convite de membro chega e o link abre `/aceitar-convite`, que aceita o convite (`pending` vira `accepted` em `organization_invitations`) e pede a senha. Neste navegador a pessoa passa a abrir a organização que convidou, e não a própria que a conta ganha ao ser criada. Quem confirmou o e-mail antes dessa tela existir não tem senha: usa "Esqueci minha senha", e depois disso o login com e-mail e senha também aceita convites pendentes;
5. ao marcar um patrocinador solicitado como “Detalhe disponível”, o solicitante recebe o aviso uma única vez;
6. confirme no painel do Resend os estados `delivered`, `bounced` e `complained`.

O aviso de patrocinador não bloqueia a publicação caso o provedor esteja indisponível: a notificação interna continua sendo criada e o painel administrativo informa a falha de envio.

## 5. Diagnóstico rápido

### `Error sending confirmation email`

Esse erro vem do Supabase Auth antes da criação da sessão. Verifique, nesta ordem:

1. SMTP personalizado habilitado no projeto correto;
2. host `smtp.resend.com`, porta `465`, usuário `resend` e chave válida;
3. remetente pertencente a um domínio verificado no Resend;
4. `Site URL` e `Redirect URLs` compatíveis com o ambiente;
5. limite de envio e eventos `bounced`/`complained` no painel do provedor;
6. logs de Authentication no Supabase para a mensagem original do SMTP.

Não exponha a chave do Resend no navegador e não desative a confirmação de e-mail como correção permanente.
