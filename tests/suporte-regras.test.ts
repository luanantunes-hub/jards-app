import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTRUCOES_DA_AJUDA,
  LIMITES_DO_SUPORTE,
  MARCA_DA_EQUIPE,
  decidirLimite,
  lerPedido,
  limparResposta,
  montarPedidoDaIa,
  paginaParaContexto,
} from "../supabase/functions/_shared/suporte-regras";

const UUID = "3f2a9c1e-5b7d-4e86-9a10-0c4d8e2f1b73";

test("a tela vai para a IA só como caminho, sem ids, parâmetros nem sujeira", () => {
  assert.equal(paginaParaContexto("/projetos"), "/projetos");
  assert.equal(paginaParaContexto(`/projetos/${UUID}`), "/projetos/[id]");
  assert.equal(paginaParaContexto(`/captacoes/${UUID}/editar?aba=notas&token=abc#topo`), "/captacoes/[id]/editar");
  assert.equal(paginaParaContexto("/prestacoes/12345/despesas"), "/prestacoes/[id]/despesas");
  assert.equal(paginaParaContexto("/atividades<script>"), "/atividadesscript");
  assert.equal(paginaParaContexto("https://exemplo.com/projetos"), "");
  assert.equal(paginaParaContexto("projetos"), "");
  assert.equal(paginaParaContexto(null), "");
  assert.equal(paginaParaContexto(42), "");
  assert.ok(paginaParaContexto(`/${"a".repeat(300)}`).length <= 80);
});

test("o pedido exige uma pergunta de verdade e limita o tamanho de tudo", () => {
  assert.deepEqual(lerPedido(null), { ok: false, erro: "Pedido inválido." });
  assert.deepEqual(lerPedido([]), { ok: false, erro: "Pedido inválido." });
  assert.equal(lerPedido({ pergunta: "  oi " }).ok, false);
  assert.equal(lerPedido({ pergunta: 123 }).ok, false);

  const longo = lerPedido({ pergunta: "x".repeat(5000), pagina: "/dashboard" });
  assert.ok(longo.ok);
  assert.equal(longo.pedido.pergunta.length, LIMITES_DO_SUPORTE.perguntaMax);
  assert.equal(longo.pedido.pagina, "/dashboard");

  const normal = lerPedido({ pergunta: "  Como crio uma negociação?  " });
  assert.ok(normal.ok);
  assert.equal(normal.pedido.pergunta, "Como crio uma negociação?");
  assert.equal(normal.pedido.pagina, "");
  assert.deepEqual(normal.pedido.historico, []);
});

test("só as últimas trocas completas da conversa entram como contexto", () => {
  const lido = lerPedido({
    pergunta: "E o plano Pro?",
    historico: [
      { pergunta: "p1", resposta: "r1" },
      { pergunta: "p2", resposta: "r2" },
      { pergunta: "sem resposta", resposta: "" },
      { pergunta: "p3", resposta: "r3" },
      "lixo",
      { pergunta: "p4", resposta: "r4" },
    ],
  });
  assert.ok(lido.ok);
  // 3 últimas posições do que veio (p3, "lixo", p4), e a que não é troca válida cai fora.
  assert.deepEqual(lido.pedido.historico.map((t) => t.pergunta), ["p3", "p4"]);
});

test("o limite por minuto e por dia segura quem exagera", () => {
  assert.deepEqual(decidirLimite(0, 0), { permitido: true });
  assert.deepEqual(decidirLimite(LIMITES_DO_SUPORTE.porMinuto - 1, LIMITES_DO_SUPORTE.porDia - 1), { permitido: true });
  const minuto = decidirLimite(LIMITES_DO_SUPORTE.porMinuto, 3);
  assert.equal(minuto.permitido, false);
  assert.match(minuto.permitido ? "" : minuto.motivo, /minuto/);
  const dia = decidirLimite(1, LIMITES_DO_SUPORTE.porDia);
  assert.equal(dia.permitido, false);
  assert.match(dia.permitido ? "" : dia.motivo, /hoje/);
});

test("o pedido à IA leva instruções, guia e tela no sistema; a conversa e a pergunta nova vão em ordem", () => {
  const pedido = montarPedidoDaIa({
    guia: "GUIA DE TESTE: o Starter custa R$ 62,90.",
    pedido: {
      pergunta: "Quanto custa?",
      pagina: "/meu-plano",
      historico: [{ pergunta: "Oi", resposta: "Olá! Como posso ajudar?" }],
    },
  });
  const sistema = pedido.systemInstruction.parts[0].text;
  assert.ok(sistema.startsWith(INSTRUCOES_DA_AJUDA));
  assert.match(sistema, /GUIA DE TESTE: o Starter custa R\$ 62,90\./);
  assert.match(sistema, /A pessoa está agora na tela: \/meu-plano$/);
  assert.deepEqual(
    pedido.contents.map((c) => [c.role, c.parts[0].text]),
    [["user", "Oi"], ["model", "Olá! Como posso ajudar?"], ["user", "Quanto custa?"]],
  );

  const semTela = montarPedidoDaIa({ guia: "G", pedido: { pergunta: "Oi?", pagina: "", historico: [] } });
  assert.doesNotMatch(semTela.systemInstruction.parts[0].text, /está agora na tela/);
});

test("as instruções mandam usar só o guia, não inventar e escalar para a equipe com a marca combinada", () => {
  assert.match(INSTRUCOES_DA_AJUDA, /apenas o GUIA/);
  assert.match(INSTRUCOES_DA_AJUDA, /Não invente/);
  assert.ok(INSTRUCOES_DA_AJUDA.includes(MARCA_DA_EQUIPE));
  assert.match(INSTRUCOES_DA_AJUDA, /senhas/);
  assert.match(INSTRUCOES_DA_AJUDA, /conselho jurídico/);
  assert.match(INSTRUCOES_DA_AJUDA, /sem markdown/);
});

test("a resposta da IA chega limpa: sem a marca da equipe, sem markdown e com tamanho limitado", () => {
  const escalada = limparResposta(`Não tenho certeza disso.\n\n${MARCA_DA_EQUIPE}`);
  assert.equal(escalada.escalar, true);
  assert.equal(escalada.resposta, "Não tenho certeza disso.");

  const normal = limparResposta("## Passo a passo\n**Vá** em Atividades.\n* Clique em Nova atividade\n• Preencha o nome\n\n\n\nPronto.");
  assert.equal(normal.escalar, false);
  assert.equal(normal.resposta, "Passo a passo\nVá em Atividades.\n- Clique em Nova atividade\n- Preencha o nome\n\nPronto.");

  const enorme = limparResposta("palavra ".repeat(1000));
  assert.ok(enorme.resposta.length <= LIMITES_DO_SUPORTE.respostaMax + 1);
  assert.ok(enorme.resposta.endsWith("…"));

  assert.deepEqual(limparResposta(undefined), { resposta: "", escalar: false });
});
