-- Ajuda e suporte dentro do app (o botão "?"): as perguntas que a pessoa faz à IA e as mensagens que ela manda
-- para a equipe.
--
-- Só acrescenta (nenhum DROP). A escrita é só do servidor, com a chave de serviço: a função suporte-assistente
-- grava as perguntas e a rota /api/suporte/mensagem grava as mensagens. O navegador não escreve aqui, e quem lê
-- é o super admin (a tela /admin/suporte).

create table if not exists public.suporte_perguntas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  organization_id  uuid references public.organizations(id) on delete set null,
  pergunta         text not null check (char_length(pergunta) <= 2000),
  resposta         text,
  -- a IA terminou mandando a pessoa falar com a equipe (não achou a resposta no guia)
  escalou          boolean not null default false,
  -- só o caminho da tela, sem ids nem parâmetros
  pagina           text,
  modelo           text,
  tokens_entrada   integer,
  tokens_saida     integer,
  custo_usd        numeric(12, 6),
  duracao_ms       integer,
  sucesso          boolean not null default true,
  erro             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_suporte_perguntas_usuario
  on public.suporte_perguntas(user_id, created_at desc);
create index if not exists idx_suporte_perguntas_data
  on public.suporte_perguntas(created_at desc);


create table if not exists public.suporte_mensagens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  organization_id  uuid references public.organizations(id) on delete set null,
  -- quem mandou, como estava no momento (a conta pode mudar depois)
  nome             text,
  email            text,
  organizacao      text,
  mensagem         text not null check (char_length(mensagem) between 1 and 4000),
  pagina           text,
  -- as últimas perguntas e respostas da IA que levaram ao contato: [{ "pergunta": "...", "resposta": "..." }]
  conversa         jsonb not null default '[]'::jsonb,
  email_enviado    boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists idx_suporte_mensagens_usuario
  on public.suporte_mensagens(user_id, created_at desc);
create index if not exists idx_suporte_mensagens_data
  on public.suporte_mensagens(created_at desc);


alter table public.suporte_perguntas enable row level security;
alter table public.suporte_mensagens enable row level security;

create policy "suporte_perguntas: super admin lê" on public.suporte_perguntas
  for select to authenticated
  using (public.is_jards_super_admin());

create policy "suporte_mensagens: super admin lê" on public.suporte_mensagens
  for select to authenticated
  using (public.is_jards_super_admin());
