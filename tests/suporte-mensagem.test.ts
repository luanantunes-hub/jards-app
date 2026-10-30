import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITES_DA_MENSAGEM,
  decidirLimiteDeMensagens,
  emailDaMensagem,
  lerMensagem,
  registrarMensagemDeSuporte,
  type DependenciasDaMensagem,
} from "../lib/suporte/mensagem";
import { bancoFalso, consultasDe, type Consulta } from "./_helpers/banco-falso";

const AGORA = Date.parse("2026-10-30T15:00:00.000Z");
const AUTOR = { userId: "usuario-1", email: "ana@exemplo.com", nome: "Ana Souza" };
const LIDA = { mensagem: "Preciso trocar de plano", pagina: "/meu-plano", conversa: [{ pergunta: "Como troco de plano?", resposta: "Peça à equipe." }] };

/** O banco responde as contagens (hora e dia) e o resto conforme a configuração do teste. */
function montar(opcoes: {
  naHora?: number;
  noDia?: number;
  erroDeContagem?: boolean;
  erroNaGravacao?: boolean;
  organizacoes?: unknown;
  email?: { ok: boolean; error?: string };
}) {
  const enviados: Parameters<DependenciasDaMensagem["enviarEmail"]>[0][] = [];
  const { admin, consultas } = bancoFalso((consulta: Consulta) => {
    if (consulta.tabela === "suporte_mensagens" && consulta.acao === "select") {
      if (opcoes.erroDeContagem) return { error: { message: "falhou" } };
      const desde = String(consulta.filtros.find(([op]) => op === "gte")?.[2]);
      const umaHora = new Date(AGORA - 3_600_000).toISOString();
      return { count: desde === umaHora ? (opcoes.naHora ?? 0) : (opcoes.noDia ?? 0) };
    }
    if (consulta.tabela === "organization_members") return { data: opcoes.organizacoes ?? { organization_id: "org-1", organizations: { nome: "Cia Teste" } } };
    if (consulta.tabela === "suporte_mensagens" && consulta.acao === "insert") {
      return opcoes.erroNaGravacao ? { error: { message: "falhou" } } : { data: { id: "msg-1" } };
    }
    return undefined;
  });
  const deps: DependenciasDaMensagem = {
    admin,
    destino: "equipe@jards.com.br",
    agora: () => AGORA,
    enviarEmail: async (email) => {
      enviados.push(email);
      return opcoes.email ?? { ok: true };
    },
  };
  return { deps, consultas, enviados };
}

test("a mensagem exige texto, limita o tamanho e só leva as últimas trocas válidas da conversa", () => {
  assert.equal(lerMensagem(null).ok, false);
  assert.equal(lerMensagem({ mensagem: "   " }).ok, false);

  const lido = lerMensagem({
    mensagem: "x".repeat(9000),
    pagina: "/projetos/3f2a9c1e-5b7d-4e86-9a10-0c4d8e2f1b73?aba=1",
    conversa: [
      { pergunta: "a", resposta: "1" }, { pergunta: "b", resposta: "2" }, { pergunta: "c", resposta: "" },
      { pergunta: "d", resposta: "4" }, { pergunta: "e", resposta: "5" },
    ],
  });
  assert.ok(lido.ok);
  assert.equal(lido.lida.mensagem.length, LIMITES_DA_MENSAGEM.max);
  assert.equal(lido.lida.pagina, "/projetos/[id]");
  // As 3 últimas posições são c, d e e; "c" não tem resposta e cai fora.
  assert.deepEqual(lido.lida.conversa.map((t) => t.pergunta), ["d", "e"]);
});

test("o limite de mensagens por hora e por dia segura quem exagera", () => {
  assert.deepEqual(decidirLimiteDeMensagens(0, 0), { permitido: true });
  assert.equal(decidirLimiteDeMensagens(LIMITES_DA_MENSAGEM.porHora, 0).permitido, false);
  assert.equal(decidirLimiteDeMensagens(0, LIMITES_DA_MENSAGEM.porDia).permitido, false);
});

test("o e-mail à equipe escapa o que a pessoa escreveu e leva o contexto", () => {
  const email = emailDaMensagem({
    nome: "Ana <b>Souza</b>",
    email: "ana@exemplo.com",
    organizacao: "Cia & Cia",
    pagina: "/meu-plano",
    mensagem: "<script>alert(1)</script>\nSegunda linha",
    conversa: [{ pergunta: "Como troco?", resposta: "<i>Peça</i> à equipe" }],
    quando: new Date("2026-10-30T15:00:00Z"),
  });
  assert.match(email.assunto, /^Suporte Jards: Ana/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.html, /Cia &amp; Cia/);
  assert.match(email.html, /&lt;i&gt;Peça&lt;\/i&gt; à equipe/);
  assert.match(email.texto, /Tela: \/meu-plano/);
  assert.match(email.texto, /Segunda linha/);
  assert.match(email.texto, /Pergunta: Como troco\?/);
  assert.match(email.texto, /E-mail: ana@exemplo\.com/);
  assert.ok(emailDaMensagem({ nome: null, email: null, organizacao: null, pagina: "", mensagem: "oi", conversa: [], quando: new Date() }).assunto.includes("Alguém"));
});

test("a mensagem é guardada, a equipe é avisada por e-mail com resposta direta para a pessoa e o envio fica marcado", async () => {
  const { deps, consultas, enviados } = montar({});
  const resultado = await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  assert.deepEqual(resultado, { ok: true, emailEnviado: true });

  const [gravacao] = consultasDe(consultas, "suporte_mensagens", "insert");
  assert.deepEqual(gravacao.valores, {
    user_id: "usuario-1",
    organization_id: "org-1",
    nome: "Ana Souza",
    email: "ana@exemplo.com",
    organizacao: "Cia Teste",
    mensagem: "Preciso trocar de plano",
    pagina: "/meu-plano",
    conversa: LIDA.conversa,
  });

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, "equipe@jards.com.br");
  assert.equal(enviados[0].replyTo, "ana@exemplo.com");
  assert.equal(enviados[0].idempotencyKey, "suporte-msg-1");

  const [marca] = consultasDe(consultas, "suporte_mensagens", "update");
  assert.deepEqual(marca.valores, { email_enviado: true });
  assert.deepEqual(marca.filtros, [["eq", "id", "msg-1"]]);
});

test("a organização vem do vínculo mesmo quando o banco devolve a relação como lista", async () => {
  const { deps, consultas } = montar({ organizacoes: { organization_id: "org-2", organizations: [{ nome: "Outra Cia" }] } });
  await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  const [gravacao] = consultasDe(consultas, "suporte_mensagens", "insert");
  assert.equal((gravacao.valores as { organizacao: string }).organizacao, "Outra Cia");
  assert.equal((gravacao.valores as { organization_id: string }).organization_id, "org-2");
});

test("passou do limite por hora, não grava nem manda e-mail", async () => {
  const { deps, consultas, enviados } = montar({ naHora: LIMITES_DA_MENSAGEM.porHora });
  const resultado = await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.ok ? 0 : resultado.status, 429);
  assert.equal(consultasDe(consultas, "suporte_mensagens", "insert").length, 0);
  assert.equal(enviados.length, 0);
});

test("sem conseguir contar as mensagens, não deixa passar (o limite é o que segura abuso)", async () => {
  const { deps, consultas, enviados } = montar({ erroDeContagem: true });
  const resultado = await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  assert.equal(resultado.ok ? 0 : resultado.status, 503);
  assert.equal(consultasDe(consultas, "suporte_mensagens", "insert").length, 0);
  assert.equal(enviados.length, 0);
});

test("se não deu para gravar, a pessoa vê o erro e a equipe não recebe e-mail de mensagem que não existe", async () => {
  const { deps, enviados } = montar({ erroNaGravacao: true });
  const resultado = await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  assert.equal(resultado.ok ? 0 : resultado.status, 500);
  assert.equal(enviados.length, 0);
});

test("se o e-mail à equipe falhar, a mensagem continua guardada e a pessoa recebe o aceite", async () => {
  const { deps, consultas } = montar({ email: { ok: false, error: "sem chave" } });
  const resultado = await registrarMensagemDeSuporte(deps, AUTOR, LIDA);
  assert.deepEqual(resultado, { ok: true, emailEnviado: false });
  assert.equal(consultasDe(consultas, "suporte_mensagens", "insert").length, 1);
  assert.equal(consultasDe(consultas, "suporte_mensagens", "update").length, 0);
});
