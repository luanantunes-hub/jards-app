import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GUIA_DO_JARDS } from "../supabase/functions/suporte-assistente/guia";

const raiz = path.resolve(__dirname, "..");
const ler = (arquivo: string) => readFile(path.join(raiz, arquivo), "utf8");

test("o guia traz os preços e planos que a página de preços publica", async () => {
  for (const trecho of ["R$ 62,90", "R$ 92,80", "R$ 19,90", "45 dias", "100 créditos", "200 créditos", "Meu plano", "Gerenciar assinatura", "Falar com a equipe"]) {
    assert.ok(GUIA_DO_JARDS.includes(trecho), `faltou "${trecho}" no guia`);
  }
  // Os valores do guia têm que ser os da página pública, que é a fonte (alguém muda lá e esquece aqui).
  const precos = await ler("public/precos.html");
  for (const valor of ["R$ 62,90", "R$ 92,80", "R$ 19,90"]) assert.ok(precos.includes(valor), `${valor} não está mais na página de preços`);
});

test("o guia cita só telas e botões que existem no menu e nas páginas do app", async () => {
  const layout = await ler("app/(dashboard)/layout.tsx");
  for (const item of ["Visão geral", "Atividades", "Reuniões", "Projetos", "Patrocinadores", "Comparativo", "Editais", "Empresas", "Negociações", "Inscrições", "Proponentes", "Captadores", "Contatos", "Clientes"]) {
    assert.ok(layout.includes(`label: "${item}"`), `o menu não tem "${item}"`);
    assert.ok(GUIA_DO_JARDS.includes(item), `o guia não fala de "${item}"`);
  }
  const configuracoes = await ler("app/(dashboard)/configuracoes/page.tsx");
  for (const aba of ["Minha equipe", "Minhas ferramentas", "Funis e etiquetas"]) {
    assert.ok(configuracoes.includes(`label: "${aba}"`), `Configurações não tem "${aba}"`);
    assert.ok(GUIA_DO_JARDS.includes(aba), `o guia não fala de "${aba}"`);
  }
  assert.ok(configuracoes.includes("Saldo de créditos"));
});

test("o guia não carrega segredo nem dado de cliente e cabe no pedido à IA", () => {
  assert.doesNotMatch(GUIA_DO_JARDS, /sk_(live|test)|rk_live|service_role|eyJ[a-zA-Z0-9]{10,}|api[_-]?key/i);
  assert.doesNotMatch(GUIA_DO_JARDS, /[\w.+-]+@[\w-]+\.[\w.]+/, "o guia não deve ter e-mail de ninguém");
  assert.doesNotMatch(GUIA_DO_JARDS, /`|\$\{/, "o guia é um template string: sem crase nem interpolação dentro");
  assert.ok(GUIA_DO_JARDS.length < 16_000, `guia grande demais (${GUIA_DO_JARDS.length} caracteres)`);
});

test("a função da ajuda exige login, só toca nas tabelas do suporte e não passa dado de cliente à IA", async () => {
  const config = await ler("supabase/config.toml");
  assert.match(config, /\[functions\.suporte-assistente\]\s*\nverify_jwt = true/);

  const funcao = await ler("supabase/functions/suporte-assistente/index.ts");
  const tabelas = [...funcao.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(tabelas)], ["organization_members", "suporte_perguntas"]);
  assert.doesNotMatch(funcao, /select\("\*"\)/);
  // O que vai à IA sai só de montarPedidoDaIa: pergunta, trocas, caminho da tela e guia.
  assert.match(funcao, /montarPedidoDaIa\(\{ guia: GUIA_DO_JARDS, pedido \}\)/);
  assert.doesNotMatch(funcao, /user\.email|user_metadata|organization_id[^\n]*(texto|text:)/);
  // Sem a contagem do limite (banco fora do ar), a função recusa em vez de deixar perguntar sem controle.
  assert.match(funcao, /noMinuto === null \|\| noDia === null/);
});

test("a tela da ajuda manda à função só a pergunta, o caminho e as trocas anteriores", async () => {
  const tela = await ler("components/suporte/AjudaFlutuante.tsx");
  assert.match(tela, /body: \{ pergunta: limpa, pagina: caminho, historico \}/);
  assert.match(tela, /body: JSON\.stringify\(\{ mensagem: limpa, pagina: caminho, conversa \}\)/);
  const layout = await ler("app/(dashboard)/layout.tsx");
  assert.match(layout, /\{user && <AjudaFlutuante \/>\}/);
});

test("a migration do suporte só acrescenta (o conector do banco recusa DROP) e liga a RLS nas duas tabelas", async () => {
  const arquivos = (await import("node:fs")).readdirSync(path.join(raiz, "supabase/migrations")).filter((nome) => /_suporte\.sql$/.test(nome));
  assert.equal(arquivos.length, 1, "esperava uma migration _suporte.sql");
  const sql = await ler(`supabase/migrations/${arquivos[0]}`);
  const semComentarios = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(semComentarios, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  for (const tabela of ["suporte_perguntas", "suporte_mensagens"]) {
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
    assert.match(sql, new RegExp(`create policy "${tabela}: super admin lê" on public\\.${tabela}\\s+for select to authenticated\\s+using \\(public\\.is_jards_super_admin\\(\\)\\)`));
  }
  // Nenhuma política de escrita para o navegador: quem grava é o servidor, com a chave de serviço.
  assert.doesNotMatch(semComentarios, /for (insert|update|delete|all)/i);
});
