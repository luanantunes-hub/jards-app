import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { ACOES_DO_HISTORICO } from "../lib/producao/estados";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.10: o teste de acesso roda no banco (supabase/tests/README.md). Estes conferem, sem
// banco, a forma da migration do histórico, que a lista de ações do SQL é a de
// lib/producao/estados.ts, que toda tabela da produção tem o gatilho (ou um motivo escrito
// aqui para não ter) e que nenhuma coluna de aparência sensível entra no histórico sem estar
// na lista de exclusão da tabela. A migration é achada pelo sufixo: a sessão que a aplica a
// renomeia para a versão gravada no banco.

const TESTE = "supabase/tests/producao_historico.test.sql";

/** As tabelas com histórico desde a migration dele (PD0.10): a lista de exclusão (1º argumento do gatilho) e as colunas do rótulo (2º). */
const ORIGENS_DA_PD0_10: Record<string, { fora: string; rotulos: string }> = {
  producao_obras: { fora: "", rotulos: "titulo" },
  producao_temporadas: { fora: "", rotulos: "titulo" },
  producao_datas: { fora: "", rotulos: "data" },
  producao_blocos: { fora: "", rotulos: "titulo,tipo" },
  producao_espacos: { fora: "", rotulos: "nome" },
  producao_salas: { fora: "", rotulos: "nome" },
  producao_funcoes: { fora: "definido_por", rotulos: "user_id" },
};

/**
 * As ligadas depois, cada uma na migration da própria tabela (gatilho e ramo novo em auth_producao_ve_historico, create or
 * replace). Os arquivos (PD0.14) deixam o nome fora do histórico (na pasta pessoas pode ser o de uma pessoa), com o caminho,
 * a impressão digital e quem enviou; o rótulo é a pasta. O teste de acesso deles é supabase/tests/producao_arquivos.test.sql.
 */
const ORIGENS_POSTERIORES: Record<string, { fora: string; rotulos: string }> = {
  producao_arquivos: { fora: "enviado_por,nome,sha256,storage_path", rotulos: "pasta" },
  // A equipe (PD1.9 e PD1.10): o e-mail e o telefone da pessoa ficam de fora. Teste: supabase/tests/producao_equipe.test.sql.
  producao_pessoas: { fora: "email,telefone", rotulos: "nome" },
  producao_vinculos: { fora: "", rotulos: "funcao" },
  producao_escalas: { fora: "", rotulos: "funcao" },
  // Viagem e hospedagem do dia (PD1.8): o localizador é um código de reserva e fica de fora.
  producao_cartoes_dia: { fora: "localizador", rotulos: "titulo" },
  // As tarefas (PD1.11): nada sensível; o título é o rótulo.
  producao_tarefas: { fora: "", rotulos: "titulo" },
  // As notas da data (PD1.6): texto livre interno; o texto é o rótulo (o histórico o corta em 500 letras).
  producao_notas: { fora: "", rotulos: "texto" },
  // Os modelos de dia da organização (PD1.7): o nome é o rótulo.
  producao_modelos_dia: { fora: "", rotulos: "nome" },
  // As pautas do espaço (PD1.5): nada sensível; o título é o rótulo.
  producao_pautas: { fora: "", rotulos: "titulo" },
  // O inventário (PD2.1): nada sensível no item (o valor mora em outra tabela, sem histórico); o nome é o rótulo.
  producao_itens: { fora: "", rotulos: "nome" },
  // As plantas (PD2.2): nada sensível; o nome é o rótulo.
  producao_plantas: { fora: "", rotulos: "nome" },
  // Os riders (PD2.5): nada sensível; o nome é o rótulo.
  producao_riders: { fora: "", rotulos: "nome" },
  // Os equipamentos da casa (PD3.2): nada sensível; o nome é o rótulo.
  producao_equipamentos: { fora: "", rotulos: "nome" },
  // Os veículos da produção (PD6.1): placa e modelo são do veículo, não de uma pessoa; o nome é o rótulo.
  producao_veiculos: { fora: "", rotulos: "nome" },
  // Os deslocamentos da data (PD6.2): o localizador (código de reserva) fica de fora; o tipo é o rótulo.
  producao_deslocamentos: { fora: "localizador", rotulos: "tipo" },
  // A hospedagem da temporada (PD6.7): o localizador (código de reserva) fica de fora; o hotel é o rótulo.
  producao_hospedagens: { fora: "localizador", rotulos: "hotel" },
  // O convite da temporada (PD6.9): o hash do código é segredo e a viagem e a observação da pessoa ficam na própria linha; a resposta é o rótulo.
  producao_convites: { fora: "token_hash,chegada_dia,chegada_hora,saida_dia,saida_hora,observacao", rotulos: "resposta" },
  // As ocorrências do dia (PD7.8): a descrição e a providência podem falar de saúde ou de pessoas e ficam de fora; o tipo é o rótulo.
  producao_ocorrencias: { fora: "descricao,providencia", rotulos: "tipo" },
  // As inscrições de voluntários (PD7.11): o contato e a disponibilidade são dado pessoal e ficam de fora; o nome é o rótulo.
  producao_voluntarios: { fora: "email,telefone,disponibilidade", rotulos: "nome" },
  // Os tipos de credencial e os convidados das sessões (PD7.2): só nome e afiliação, sem documento nem contato; o nome é o rótulo.
  producao_credencial_tipos: { fora: "", rotulos: "nome" },
  producao_convidados: { fora: "", rotulos: "nome" },
  // A acessibilidade por sessão (PD7.6): a nota pode falar de uma pessoa do público e fica de fora; o tipo é o rótulo.
  producao_acessibilidade: { fora: "notas", rotulos: "tipo" },
  // A visitação e os grupos (PD7.5): o contato do responsável e a observação ficam de fora; o dia e o grupo são os rótulos. O link é só o hash e a validade.
  producao_visitas_horarios: { fora: "", rotulos: "dia" },
  producao_visitas_agendamentos: { fora: "email,telefone,observacao,consentiu_em", rotulos: "grupo" },
  // Os turnos da equipe da casa (PD3.4): só dia, hora e função; o dia é o rótulo.
  producao_turnos: { fora: "", rotulos: "dia" },
  // As licenças da data (PD4.9): o tipo é o rótulo; o protocolo é um número público do pedido, não dado pessoal.
  producao_licencas: { fora: "", rotulos: "tipo" },
  // O site do espaço (PD12.1): o nome do site e o título da página são o rótulo; o JSON dos blocos fica de fora (grande).
  producao_sites: { fora: "", rotulos: "nome" },
  producao_site_paginas: { fora: "blocos,blocos_publicados", rotulos: "titulo" },
  // As sessões da grade de programação (PD8.1): só dia, hora, título e notas; o dia é o rótulo.
  producao_sessoes: { fora: "", rotulos: "dia" },
  // O acerto técnico (PD4.1 e PD4.2): o modelo deixa de fora o JSON dos campos (grande); o acerto deixa de fora o hash do
  // link e quem respondeu (nome e e-mail digitados são dado pessoal).
  producao_modelos_acerto: { fora: "campos", rotulos: "nome" },
  producao_acertos: { fora: "token_hash,respondente_nome,respondente_email", rotulos: "modelo_nome" },
};

/** Todas as tabelas com histórico hoje. */
const ORIGENS: Record<string, { fora: string; rotulos: string }> = { ...ORIGENS_DA_PD0_10, ...ORIGENS_POSTERIORES };

/**
 * Tabelas da produção que NÃO têm gatilho de histórico, cada uma com o motivo. Uma tabela nova da
 * produção que não esteja em ORIGENS nem aqui reprova o teste: decida (gatilho e ramo em
 * auth_producao_ve_historico, ou o motivo). Dado pessoal mora em tabela separada, sem histórico.
 */
const SEM_HISTORICO: Record<string, string> = {
  producao_historico: "é o próprio histórico: nunca grava o histórico do próprio histórico",
  producao_acessos_equipe: "é só o convite de acesso: o e-mail é dado pessoal e quem convidou já fica na própria linha",
  producao_vinculos_valores: "é só cachê e diária: com o histórico, o valor iria para uma linha que quem não vê o dinheiro também lê",
  producao_itens_valores: "é só o valor do item e da locação: com o histórico, o valor iria para uma linha que quem não vê o dinheiro também lê",
  producao_planta_objetos: "é só a posição, o tamanho e a rotação de cada objeto na planta: muda a cada arrasto e o histórico da planta já conta o que importa",
  producao_rider_itens: "são só as linhas do rider (texto, quantidade e se é obrigatório): o histórico do rider já conta o que importa",
  producao_espaco_fichas: "tem o contato de quem cuida do espaço (telefone e e-mail são dado pessoal) e o resto é texto e medida do lugar: o espaço já tem o histórico dele",
  producao_acerto_itens: "são os campos do acerto (o que a produção escreveu, o que a casa respondeu e a revisão): quem revisou e quando já ficam na própria linha, e o histórico do acerto conta o resto",
  producao_programacao_links: "é só o link público da programação (título e hash do código, que é segredo): quem criou e quando já ficam na própria linha",
  producao_site_dominios: "são os domínios da pessoa ligados ao site, escritos só pelo servidor depois de conferir o DNS: quem criou e quando já ficam na própria linha, e o token de verificação é segredo",
  producao_sala_fichas: "é só a ficha técnica da sala (medidas e texto): muda pouco e o histórico da sala já conta o que importa",
  producao_veiculo_documentos: "são só os papéis de um veículo (tipo, número e validade): o histórico do veículo e a própria validade dizem o que importa",
  producao_quartos: "são só os quartos de uma hospedagem (nome e capacidade): o histórico da hospedagem e a própria lista de quartos dizem o que importa",
  producao_ocupantes: "é só a ligação de uma pessoa a um quarto: quem está em cada quarto já se vê na lista, e o histórico da hospedagem conta o resto",
  producao_deslocamento_pessoas: "é só a ligação de uma pessoa a um deslocamento: quem vai já se vê na lista, e o histórico do deslocamento conta o resto",
  producao_checklist_itens: "é a lista do deslocamento: a situação e a hora de cada conferência já ficam na própria linha, e o histórico do deslocamento conta o resto",
  producao_abastecimentos: "é só o registro de um abastecimento (litros, combustível, posto e hora): quem registrou e quando já ficam na própria linha, e o histórico do deslocamento conta o resto",
  producao_voluntarios_links: "é só o link de inscrição (título, vagas e o hash do código, que é segredo): quem criou e quando já ficam na própria linha",
  producao_convidados_links: "é só o link de pedidos (título, corte, limite e o hash do código, que é segredo): quem criou e quando já ficam na própria linha",
  producao_visitas_links: "é só o link de agendamento de visitas (título, validade e o hash do código, que é segredo): quem criou e quando já ficam na própria linha",
  producao_credenciais: "é só o código da credencial (hash, que é segredo) e a contagem de entradas, que muda a cada leitura na porta: quem emitiu e quando já ficam na própria linha, e cada leitura é registrada em producao_porta_leituras",
  producao_porta_leituras: "é o próprio registro da porta, só de acrescentar: ninguém altera nem apaga uma leitura",
  producao_manutencoes: "são só as manutenções de um equipamento (descrição e datas): o histórico do equipamento e a própria data dizem o que importa",
  producao_item_datas: "é só a ligação do item à data e a quantidade: o histórico do item e o da data já contam o que importa",
};

/** Nome de coluna que parece dinheiro, documento, banco, saúde ou contato: precisa estar na lista de exclusão. */
const PARECE_SENSIVEL = /(valor|cache|custo|preco|pago|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|passaporte|saude|alergia|restricao|documento|telefone|celular|email|nascimento)|(^|_)(rg|cpf|cnpj|pix|cnh)(_|$)/i;

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function achar(sufixo: string): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}
const migration = () => achar("_producao_historico.sql");

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
const comandosDe = (sql: string) => dividirComandos(semComentarios(sql)).map(normalizar);

/** O texto entre o parêntese que abre em `ini` e o que o fecha. */
function dentroDosParenteses(texto: string, ini: number): string {
  let fundo = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto[i] === "(") fundo++;
    if (texto[i] === ")" && --fundo === 0) return texto.slice(ini + 1, i);
  }
  throw new Error("parêntese sem fechamento");
}

/** Divide nas vírgulas de nível zero, sem olhar o que está entre aspas. */
function itensDe(corpo: string): string[] {
  const itens: string[] = [];
  let atual = "", fundo = 0, aspas = false;
  for (const c of corpo) {
    if (c === "'") aspas = !aspas;
    if (!aspas && c === "(") fundo++;
    if (!aspas && c === ")") fundo--;
    if (c === "," && fundo === 0 && !aspas) { itens.push(atual.trim()); atual = ""; } else atual += c;
  }
  if (atual.trim()) itens.push(atual.trim());
  return itens;
}

/** Os itens (colunas e restrições) de cada create table da migration. */
function tabelasDe(comandos: string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const comando of comandos) {
    const m = /^create table (?:if not exists )?public\.(\w+) \(/.exec(comando);
    if (m) mapa.set(m[1], itensDe(dentroDosParenteses(comando, m[0].length - 1)));
  }
  return mapa;
}

const colunasDe = (itens: string[]) => itens.filter(i => !/^constraint /.test(i)).map(i => i.split(" ")[0]);

/** As restrições nomeadas: nome → texto depois do nome. */
function restricoesDe(itens: string[]): Map<string, string> {
  return new Map(itens.flatMap(i => {
    const m = /^constraint (\w+) (.*)$/.exec(i);
    return m ? [[m[1], m[2]] as const] : [];
  }));
}

/** As colunas de toda tabela da produção, juntando o create table e os add column de todas as migrations. */
async function colunasDaProducao(): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>();
  for (const nome of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
    const comandos = comandosDe(await readFile(`supabase/migrations/${nome}`, "utf8"));
    for (const [tabela, itens] of tabelasDe(comandos)) {
      if (tabela.startsWith("producao_")) mapa.set(tabela, new Set(colunasDe(itens)));
    }
    for (const comando of comandos) {
      const m = /^alter table (?:only )?public\.(producao_\w+) (.*)$/.exec(comando);
      if (!m) continue;
      for (const adicao of m[2].matchAll(/add column (?:if not exists )?(\w+)/g)) mapa.get(m[1])?.add(adicao[1]);
    }
  }
  return mapa;
}

/** Os gatilhos de histórico de todas as migrations: tabela → argumentos. */
async function gatilhosDeHistorico(): Promise<Map<string, { fora: string[]; rotulos: string }>> {
  const mapa = new Map<string, { fora: string[]; rotulos: string }>();
  for (const nome of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
    for (const comando of comandosDe(await readFile(`supabase/migrations/${nome}`, "utf8"))) {
      const m = /^create or replace trigger \w+ after insert or update or delete on public\.(\w+) for each row execute function public\.fn_producao_historico\('([^']*)', '([^']*)'\)$/.exec(comando);
      if (m) mapa.set(m[1], { fora: m[2].split(",").filter(Boolean), rotulos: m[3] });
    }
  }
  return mapa;
}

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada`);
  return comando;
}

test("a migration vem depois de espaços e salas e é de expansão: sem DROP, reaplicável, só o que é da entrega", async () => {
  const { nome, sql } = await migration();
  const nomes = await readdir("supabase/migrations");
  for (const anterior of nomes.filter(n => /_producao_(permissoes|esqueleto|esqueleto_chaves_adiadas|espacos)\.sql$/.test(n))) {
    assert.ok(anterior < nome, `${nome} tem de vir depois de ${anterior}`);
  }
  assert.ok(nomes.some(n => n.endsWith("_producao_espacos.sql")), "o histórico liga também em espaço e sala");
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\b(drop|truncate)\b/i);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  const criacoes = comandos.filter(c => /^create /.test(c));
  assert.equal(criacoes.filter(c => /^create table if not exists public\.producao_historico \(/.test(c)).length, 1);
  assert.equal(criacoes.filter(c => /^create index if not exists producao_historico_\w+ on public\.producao_historico /.test(c)).length, 3);
  assert.equal(criacoes.filter(c => /^create or replace function public\.(fn_producao_historico|auth_producao_ve_historico)\(/.test(c)).length, 2);
  assert.equal(criacoes.filter(c => /^create or replace trigger producao_\w+_historico after insert or update or delete on public\.producao_/.test(c)).length, 7);
  assert.equal(criacoes.length, 1 + 3 + 2 + 7, "nada é criado sem `if not exists` nem `or replace`");
  const primeiras = [...new Set(comandos.map(c => c.split(" ")[0]))].sort();
  assert.deepEqual(primeiras, ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
  assert.deepEqual(comandos.filter(c => /^alter /.test(c)), ["alter table public.producao_historico enable row level security"]);
});

test("a tabela: colunas, chaves e restrições; a lista de ações do SQL é a de lib/producao/estados.ts", async () => {
  const tabelas = tabelasDe(comandosDe((await migration()).sql));
  const itens = tabelas.get("producao_historico")!;
  assert.deepEqual(colunasDe(itens), ["id", "organization_id", "entidade", "entidade_id", "acao", "campo", "antes", "depois", "quem", "quando"]);
  const coluna = (nome: string) => itens.find(i => i.startsWith(`${nome} `));
  assert.equal(coluna("id"), "id bigint generated always as identity primary key");
  assert.equal(coluna("organization_id"), "organization_id uuid not null references public.organizations (id) on delete cascade");
  assert.equal(coluna("entidade_id"), "entidade_id uuid not null", "sem chave: o histórico sobrevive ao registro apagado");
  assert.equal(coluna("quem"), "quem uuid references auth.users (id) on delete set null", "apagar a conta só zera o quem");
  assert.equal(coluna("quando"), "quando timestamptz not null default now()");
  const restricoes = restricoesDe(itens);
  assert.deepEqual([...restricoes.keys()].sort(), [
    "producao_historico_acao_check", "producao_historico_campo_check", "producao_historico_entidade_check",
    "producao_historico_forma_check", "producao_historico_valores_check",
  ]);
  // A lista fechada do SQL é a do código, na mesma ordem.
  const lista = [...(/ in \((.*)\)/.exec(restricoes.get("producao_historico_acao_check") ?? "")?.[1] ?? "").matchAll(/'([^']*)'/g)].map(m => m[1]);
  assert.deepEqual(lista, [...ACOES_DO_HISTORICO]);
  assert.equal(new Set(ACOES_DO_HISTORICO).size, ACOES_DO_HISTORICO.length);
  // A entidade é aberta: só a forma (tabela da produção, que não é o próprio histórico).
  assert.equal(restricoes.get("producao_historico_entidade_check"), "check (entidade ~ '^producao_[a-z0-9_]{1,50}$' and entidade <> 'producao_historico')");
  assert.equal(restricoes.get("producao_historico_campo_check"), "check ((acao = 'alterou') = (campo is not null) and (campo is null or char_length(campo) between 1 and 63))");
  assert.equal(restricoes.get("producao_historico_valores_check"), "check (char_length(antes) <= 500 and char_length(depois) <= 500)");
  assert.equal(restricoes.get("producao_historico_forma_check"), "check ((acao <> 'criou' or antes is null) and (acao <> 'apagou' or depois is null))");
});

test("os índices: por registro (entidade, id, quando), por organização e por autor; toda chave tem o seu", async () => {
  const indices = comandosDe((await migration()).sql).filter(c => /^create index /.test(c));
  assert.deepEqual(indices.sort(), [
    "create index if not exists producao_historico_entidade_idx on public.producao_historico (entidade, entidade_id, quando desc, id desc)",
    "create index if not exists producao_historico_org_idx on public.producao_historico (organization_id, quando desc, id desc)",
    "create index if not exists producao_historico_quem_idx on public.producao_historico (quem) where quem is not null",
  ]);
});

test("toda tabela da produção tem o gatilho de histórico, com a lista de exclusão e o rótulo dela, ou um motivo escrito no teste", async () => {
  const { sql } = await migration();
  const gatilhos = comandosDe(sql).filter(c => c.startsWith("create or replace trigger "));
  assert.deepEqual([...gatilhos].sort(), Object.entries(ORIGENS_DA_PD0_10).map(([tabela, { fora, rotulos }]) =>
    `create or replace trigger ${tabela}_historico after insert or update or delete on public.${tabela} for each row execute function public.fn_producao_historico('${fora}', '${rotulos}')`).sort());
  // Toda tabela da produção, de qualquer migration, está em ORIGENS ou em SEM_HISTORICO (com o motivo).
  const colunas = await colunasDaProducao();
  const decididas = new Set([...Object.keys(ORIGENS), ...Object.keys(SEM_HISTORICO)]);
  for (const tabela of colunas.keys()) {
    assert.ok(decididas.has(tabela), `${tabela}: tabela nova da produção sem histórico. Ligue o gatilho (e um ramo em auth_producao_ve_historico), ou escreva o motivo em SEM_HISTORICO`);
  }
  for (const tabela of Object.keys(ORIGENS)) assert.ok(colunas.has(tabela), `${tabela} não existe em nenhuma migration`);
  // E o gatilho das migrations é o mesmo que o teste espera: ninguém religou uma tabela com outra lista.
  const todos = await gatilhosDeHistorico();
  assert.deepEqual([...todos.keys()].sort(), Object.keys(ORIGENS).sort());
  for (const [tabela, { fora, rotulos }] of Object.entries(ORIGENS)) {
    assert.deepEqual(todos.get(tabela), { fora: fora.split(",").filter(Boolean), rotulos }, tabela);
  }
});

test("a lista de exclusão: toda coluna listada existe, e nenhuma coluna de aparência sensível fica de fora dela", async () => {
  const colunas = await colunasDaProducao();
  const gatilhos = await gatilhosDeHistorico();
  assert.ok(gatilhos.size >= Object.keys(ORIGENS).length);
  for (const [tabela, { fora, rotulos }] of gatilhos) {
    const existentes = colunas.get(tabela);
    assert.ok(existentes, `${tabela}: sem create table`);
    for (const coluna of fora) assert.ok(existentes.has(coluna), `${tabela}: a lista de exclusão cita ${coluna}, que não é coluna`);
    for (const coluna of rotulos.split(",")) assert.ok(existentes.has(coluna), `${tabela}: o rótulo cita ${coluna}, que não é coluna`);
    for (const coluna of existentes) {
      if (PARECE_SENSIVEL.test(coluna)) assert.ok(fora.includes(coluna), `${tabela}.${coluna} parece sensível (dinheiro, documento, banco, saúde, contato) e não está na lista de exclusão do gatilho`);
    }
    // O rótulo de criar e apagar é de um campo à vista, nunca de um da lista.
    for (const coluna of rotulos.split(",")) assert.ok(!fora.includes(coluna), `${tabela}: o rótulo ${coluna} está na lista de exclusão`);
  }
  // Hoje as colunas fora são as que repetem o autor, nos arquivos o nome (dado de pessoa na pasta pessoas), o caminho, a
  // impressão digital e quem enviou, e nas pessoas da equipe o contato (e-mail e telefone).
  assert.deepEqual([...gatilhos].filter(([, g]) => g.fora.length).map(([t, g]) => `${t}: ${g.fora.join(",")}`).sort(),
    ["producao_acertos: token_hash,respondente_nome,respondente_email", "producao_acessibilidade: notas", "producao_arquivos: enviado_por,nome,sha256,storage_path", "producao_cartoes_dia: localizador", "producao_convites: token_hash,chegada_dia,chegada_hora,saida_dia,saida_hora,observacao", "producao_deslocamentos: localizador", "producao_funcoes: definido_por", "producao_hospedagens: localizador", "producao_modelos_acerto: campos", "producao_ocorrencias: descricao,providencia", "producao_pessoas: email,telefone", "producao_site_paginas: blocos,blocos_publicados", "producao_visitas_agendamentos: email,telefone,observacao,consentiu_em", "producao_voluntarios: email,telefone,disponibilidade"]);
});

test("o gatilho: uma linha por campo, nada de controle, nunca o histórico do histórico, o autor só se existe e o apagar da organização não trava", async () => {
  const comandos = comandosDe((await migration()).sql);
  const corpo = funcao(comandos, "fn_producao_historico");
  assert.match(corpo, /^create or replace function public\.fn_producao_historico\(\) returns trigger language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as \$\$/);
  assert.doesNotMatch(corpo, /\bexecute\b/i, "sem SQL dinâmico: os argumentos do gatilho nunca viram comando");
  assert.match(corpo, /array\['id', 'organization_id', 'created_at', 'updated_at'\] \|\| string_to_array\(coalesce\(tg_argv\[0\], ''\), ','\)/, "o que nunca vira linha, mais a lista da tabela");
  assert.match(corpo, /if tg_table_name = 'producao_historico' then return null;/, "nunca o histórico do próprio histórico");
  // Alterar: só o que mudou, pelo conteúdo, com o texto cortado.
  assert.match(corpo, /from jsonb_each\(to_jsonb\(new\) - v_fora\) n join jsonb_each\(to_jsonb\(old\) - v_fora\) o on o\.key = n\.key where n\.value is distinct from o\.value/);
  assert.match(corpo, /left\(o\.value #>> '\{\}', 500\), left\(n\.value #>> '\{\}', 500\)/);
  // Criar e apagar: uma linha, com o rótulo no depois (criou) ou no antes (apagou).
  assert.match(corpo, /case tg_op when 'INSERT' then 'criou' else 'apagou' end, case when tg_op = 'DELETE' then v_rotulo end, case when tg_op = 'INSERT' then v_rotulo end/);
  assert.match(corpo, /select left\(btrim\(v_linha ->> r\.coluna\), 200\) into v_rotulo/);
  // Apagar a organização inteira: a organização já não existe, e a linha não teria onde ficar.
  assert.match(corpo, /else v_linha := to_jsonb\(old\); v_org := old\.organization_id; v_id := old\.id; if not exists \(select 1 from public\.organizations org where org\.id = v_org\) then return null; end if; end if;/);
  // O autor: a conta logada, se ainda existir; sem usuário, nulo.
  assert.match(corpo, /v_quem := \(select u\.id from auth\.users u where u\.id = auth\.uid\(\)\);/);
  assert.equal([...corpo.matchAll(/auth\.uid\(\)/g)].length, 1, "auth.uid() só entra pela consulta do autor");
  assert.match(corpo, /return null; end; \$\$$/);
  assert.ok(comandos.includes("revoke execute on function public.fn_producao_historico() from public, anon, authenticated"), "ninguém chama o gatilho");
  assert.ok(!comandos.some(c => c.startsWith("grant execute") && c.includes("fn_producao_historico")), "ninguém recebe execute do gatilho");
});

test("quem vê o histórico: a origem diz, com as regras de quem consulta, e a entidade que a função não conhece nega", async () => {
  const comandos = comandosDe((await migration()).sql);
  const corpo = funcao(comandos, "auth_producao_ve_historico");
  assert.match(corpo, /^create or replace function public\.auth_producao_ve_historico\(p_org uuid, p_entidade text, p_entidade_id uuid\) returns boolean language sql stable set search_path = public, pg_temp as \$\$/);
  assert.doesNotMatch(corpo, /security definer/, "roda com a permissão de quem consulta: a origem passa pelas regras dele");
  const ramos = [...corpo.matchAll(/when '(\w+)' then exists \(select 1 from public\.(\w+) x where x\.id = p_entidade_id and x\.organization_id = p_org\)/g)];
  assert.deepEqual(ramos.map(m => m[1]), Object.keys(ORIGENS_DA_PD0_10), "um ramo por tabela com histórico, na ordem");
  assert.ok(ramos.every(m => m[1] === m[2]), "o ramo consulta a própria tabela");
  assert.match(corpo, /select coalesce\(case p_entidade when /);
  assert.match(corpo, / end, false\); \$\$$/, "o que a função não conhece nega");
  assert.doesNotMatch(corpo, /\belse\b/);
  assert.ok(comandos.includes("revoke execute on function public.auth_producao_ve_historico(uuid, text, uuid) from public, anon"));
  assert.ok(comandos.includes("grant execute on function public.auth_producao_ve_historico(uuid, text, uuid) to authenticated"));
});

test("a leitura acompanha a origem; não há regra de escrita e o navegador só lê", async () => {
  const comandos = comandosDe((await migration()).sql);
  assert.ok(comandos.includes("alter table public.producao_historico enable row level security"));
  const bloco = comandos.find(c => c.startsWith("do $$") && c.includes("create policy"))!;
  const politicas = [...bloco.matchAll(/create policy "([^"]+)" on public\.(\w+) for (\w+) to (\w+) using \((.*?)\); end if;/g)];
  assert.deepEqual(politicas.map(m => [m[1], m[2], m[3], m[4], m[5]]), [
    ["producao_historico: le", "producao_historico", "select", "authenticated",
      "public.auth_producao_pode(organization_id, 'ler') and public.auth_producao_ve_historico(organization_id, entidade, entidade_id)"],
    ["producao_historico: leitura sem assinatura", "producao_historico", "select", "authenticated",
      "public.auth_producao_le_sem_assinatura(organization_id) and public.auth_producao_ve_historico(organization_id, entidade, entidade_id)"],
  ]);
  assert.equal([...bloco.matchAll(/create policy/g)].length, 2, "só as duas de leitura");
  assert.doesNotMatch(bloco, /for (insert|update|delete|all)\b|with check|\(true\)|using true/i);
  const revoke = comandos.indexOf("revoke all on public.producao_historico from anon, authenticated");
  const grant = comandos.indexOf("grant select on public.producao_historico to authenticated");
  assert.ok(revoke >= 0 && grant > revoke, "revoga tudo e só então devolve o select");
  assert.deepEqual(comandos.filter(c => /^grant /.test(c)), [
    "grant execute on function public.auth_producao_ve_historico(uuid, text, uuid) to authenticated",
    "grant select on public.producao_historico to authenticated",
  ]);
});

test("toda tabela producao_* de toda migration liga a segurança por linha, não tem regra aberta e fecha o visitante (inclui o histórico)", async () => {
  const sql = semComentarios((await migration()).sql);
  assert.match(sql, /alter table public\.producao_historico enable row level security/);
  assert.match(sql, /revoke all on public\.producao_historico from anon/);
  assert.doesNotMatch(sql, /using \(\s*true\s*\)|with check \(\s*true\s*\)/i);
});

test("o cabeçalho diz o que o histórico guarda, quem lê, quem escreve, a lista de exclusão e o que o dono decide", async () => {
  const { sql } = await migration();
  const cabecalho = sql.slice(0, sql.indexOf("set local lock_timeout"));
  for (const trecho of [
    "PD0.10", "PD1.6", "PD0.9", "PD1.9", "fn_producao_historico", "auth_producao_ve_historico", "lista de exclusão", "sensíve",
    "uma linha por campo", "apagar a organização", "on delete cascade", "security definer", "producao_funcoes", "definido_por",
    "UTC", "500", "auth.uid()", "decisão do dono", "política de dados pessoais", "sem DROP", "expurgo",
  ]) assert.ok(cabecalho.toLowerCase().includes(trecho.toLowerCase()), `o cabeçalho não cita ${trecho}`);
  assert.doesNotMatch(cabecalho, /\d{14}_producao/, "o cabeçalho não depende da data do arquivo da migration irmã");
});

test("o teste de acesso cobre o aceite, a lista de exclusão, a leitura por pessoa, a escrita só pelo gatilho e o apagar", async () => {
  const teste = await readFile(TESTE, "utf8");
  const { sql } = await migration();
  for (const [, itens] of tabelasDe(comandosDe(sql))) {
    for (const nome of restricoesDe(itens).keys()) {
      if (nome.endsWith("_check")) assert.ok(teste.includes(nome), `a restrição ${nome} fora do teste de acesso`);
    }
  }
  for (const tabela of Object.keys(ORIGENS_DA_PD0_10)) assert.ok(teste.includes(`${tabela}_historico`) || teste.includes(`'${tabela}'`), `${tabela} fora do teste de acesso`);
  for (const caso of [
    "'leitor'", "'captador'", "'proponente'", "status = 'cancelado'", "'vinculado'", "jards_super_admin", "ph_teste.como(null)",
    "mudar a hora de um bloco aparece no histórico", "cache,documento", "SEGREDO", "definido_por", "producao_sonda_hist",
    "permission denied for table producao_historico", "permission denied for function fn_producao_historico", "producao_pautas",
    "2026-11-20T22:30:00+00:00", "repeat('x', 2000)", "delete from public.organizations", "delete from public.organization_members",
    "delete from public.producao_blocos", "delete from public.producao_datas", "delete from public.producao_historico",
    "gen_random_uuid()", "set_config('request.jwt.claims'",
  ]) assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  assert.ok(teste.includes("0d100000-0000-4000-8000-"), "o teste usa o prefixo de ids da entrega");
  assert.doesNotMatch(teste, /\d{14}_producao_historico/, "o teste não depende da data do arquivo da migration");
  // Só a seção "Apagar" usa DELETE, para o conector poder recusá-la sem levar o resto junto.
  const apagar = teste.indexOf("-- ─── Apagar");
  assert.ok(apagar > 0);
  assert.doesNotMatch(teste.slice(0, apagar).replace(/--.*$/gm, ""), /\bdelete from\b/i, "DELETE fora da seção Apagar");
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});

test("o README dos testes de banco descreve o teste do histórico e a ordem das duas migrations", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_historico\.test\.sql` confere a PD0\.10/);
  assert.match(leia, /tests\/producao-historico-sql\.test\.ts/);
  assert.match(leia, /producao_espacos` e `producao_historico`, nessa ordem/);
});
