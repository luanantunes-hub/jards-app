import assert from "node:assert/strict";
import test from "node:test";
import { REGIMES } from "../lib/prestacao/regimes";
import {
  aplicarMudanca,
  avaliarLeitura,
  conferirLeitura,
  lerCaminho,
  mesmoValor,
  passosDoCaminho,
  caminhoDosPassos,
  promptDaLeituraNormativa,
  regimeAchatado,
  type LeituraDaIa,
  type MudancaLida,
  type PropostaConferida,
} from "../supabase/functions/_shared/proposta-regime";
import { CONJUNTO, textoDoCaso } from "../supabase/functions/_shared/conjunto-normativo";

const regime = (codigo: string) => {
  const achado = Object.values(REGIMES).find(r => r.codigo === codigo);
  assert.ok(achado, `regime ${codigo} não existe`);
  return structuredClone(achado) as unknown as Record<string, unknown>;
};
const caso = (codigo: string) => CONJUNTO.find(c => c.codigo === codigo)!;

/** A fonte mais próxima de um caminho, como o regime conferido a registra. */
function fonteDe(reg: unknown, caminho: string): string {
  const passos = passosDoCaminho(caminho)!;
  for (let n = passos.length; n > 0; n--) {
    const fonte = lerCaminho(reg, `${caminhoDosPassos(passos.slice(0, n))}.fonte`).valor as { documento?: string; dispositivo?: string } | undefined;
    if (fonte?.documento) return `${fonte.documento}, ${fonte.dispositivo ?? ""}`;
  }
  return "";
}

// O documento de cada caso real, como aparece na fonte do regime conferido.
const DOCUMENTO_NA_FONTE: Record<string, string> = {
  lie_portaria_10_2026: "Portaria MESP 10/2026",
  saude_anexo_lxxxvi_a: "Anexo LXXXVI-A",
};

test("o gabarito são mudanças de verdade, que o próprio documento traz", () => {
  assert.equal(new Set(CONJUNTO.map(c => c.codigo)).size, CONJUNTO.length);
  for (const c of CONJUNTO) {
    const antigo = regime(c.regime);
    const conferido = c.esperado.regime ? regime(c.esperado.regime) : null;
    assert.ok("fonte" in c.documento || "texto" in c.documento, c.codigo);
    if (c.esperado.mudancas.length === 0) assert.ok(!c.esperado.classificacoes.includes("altera_regra"), c.codigo);
    for (const m of c.esperado.mudancas) {
      const antes = lerCaminho(antigo, m.caminho);
      assert.ok(antes.existe, `${c.codigo}: ${m.caminho} não existe no regime de partida`);
      const valor = "valor" in m ? m.valor : lerCaminho(conferido, m.caminho).valor;
      assert.ok(valor !== undefined, `${c.codigo}: ${m.caminho} sem valor esperado`);
      assert.ok(!mesmoValor(antes.valor, valor), `${c.codigo}: ${m.caminho} não muda`);
      // O valor esperado vem do documento lido, não de outra norma.
      if (conferido) assert.ok(fonteDe(conferido, m.caminho).includes(DOCUMENTO_NA_FONTE[c.codigo]), `${c.codigo}: ${m.caminho} vem de ${fonteDe(conferido, m.caminho)}`);
    }
  }
  // Os dois casos reais cobrem prazos, alterações, contas, pagamentos e envio.
  assert.equal(caso("lie_portaria_10_2026").esperado.mudancas.length, 7);
  assert.equal(caso("saude_anexo_lxxxvi_a").esperado.mudancas.length, 10);
});

test("o documento do caso pode começar num trecho da página", () => {
  assert.equal(textoDoCaso("ANEXO LXXXVI (revogado)\nANEXO LXXXVI-A\nArt. 1º", "ANEXO LXXXVI-A"), "ANEXO LXXXVI-A\nArt. 1º");
  assert.equal(textoDoCaso("sem o marcador", "ANEXO LXXXVI-A"), "sem o marcador");
});

test("quando o documento substitui a norma, o pedido diz isso à IA", () => {
  const contexto = {
    documento: { titulo: "Portaria MESP 10/2026", tipo: "Portaria", orgao: "Ministério do Esporte", publicadoEm: "2026-03-04", url: null },
    texto: "Art. 1º …",
    trechosQueMudaram: null,
    regime: { codigo: "lie_p424_2020", nome: "LIE — Portaria 424/2020", versao: 2, normaReferencia: "Portaria MC 424/2020", achatado: "prazos.recurso.quantidade = 30" },
  };
  assert.ok(!promptDaLeituraNormativa(contexto).includes("substitui"));
  assert.ok(promptDaLeituraNormativa({ ...contexto, normaAnterior: "Portaria MC 424/2020" })
    .includes("O documento substitui a norma em que o regime se baseia (Portaria MC 424/2020)"));
});

// ─── Nota, com o caso da Rouanet (texto no próprio caso) ────────────────────

const rouanet = caso("rouanet_in40_simulada");
const textoRouanet = "texto" in rouanet.documento ? rouanet.documento.texto : "";
const mudanca = (m: Partial<MudancaLida>): MudancaLida => ({
  operacao: "alterar", caminho: "", valorProposto: "null", dispositivo: "art. 1º", citacao: "", explicacao: "", aConfirmar: false, ...m,
});
const PRAZO = mudanca({
  caminho: "prazos.prestacaoFinal.quantidade", valorProposto: "90",
  citacao: "No período improrrogável de 90 (noventa) dias após o término da vigência do projeto",
});
const TETO = mudanca({
  caminho: "orcamento.tetos[codigo=administracao].percentual", valorProposto: "12",
  citacao: "não poderá ultrapassar o limite de 12% (doze por cento) do valor do projeto",
});

function lerRouanet(classificacao: LeituraDaIa["classificacao"], mudancas: MudancaLida[]) {
  const leitura: LeituraDaIa = {
    classificacao, resumo: "", vigencia: null, transicao: { aplicaEmAndamento: null, explicacao: "" }, mudancas, checagensNovas: [],
  };
  const antigo = regime("rouanet_in29_2026");
  const conferida = conferirLeitura(antigo, leitura, { documento: rouanet.documento.titulo, url: null, texto: textoRouanet });
  return avaliarLeitura(rouanet, { antigo }, { classificacao, conferida });
}

test("leitura certa: as duas mudanças, nada além", () => {
  const r = lerRouanet("altera_regra", [PRAZO, TETO]);
  assert.equal(r.classificacaoCerta, true);
  assert.equal(r.cobertura, 1);
  assert.deepEqual(r.acertos.map(a => a.caminho), ["prazos.prestacaoFinal.quantidade", "orcamento.tetos[codigo=administracao].percentual"]);
  assert.deepEqual([r.erradas, r.faltas, r.falsosAlarmes, r.descartadas], [[], [], [], 0]);
});

test("valor errado, citação inventada e mudança fora do gabarito", () => {
  const r = lerRouanet("altera_regra", [
    { ...TETO, valorProposto: "13" },
    { ...PRAZO, citacao: "O prazo final passa a ser de 90 dias corridos" },
    mudanca({ caminho: "prazos.recurso.quantidade", valorProposto: "20", citacao: "Esta Instrução Normativa entra em vigor em 1º de janeiro de 2027" }),
    mudanca({
      caminho: "orcamento.tetos[codigo=administracao].descricao", valorProposto: "\"Custos de administração\"",
      citacao: "A previsão dos custos de administração não poderá ultrapassar o limite",
    }),
  ]);
  assert.deepEqual(r.erradas, [{ caminho: "orcamento.tetos[codigo=administracao].percentual", esperado: 12, proposto: 13 }]);
  // A citação que não está no texto é descartada: o prazo fica como estava.
  assert.equal(r.descartadas, 1);
  assert.deepEqual(r.faltas, [{ caminho: "prazos.prestacaoFinal.quantidade", esperado: 90, atual: 60 }]);
  assert.deepEqual(r.falsosAlarmes.map(f => [f.caminho, f.proposto]), [["prazos.recurso.quantidade", 20]]);
  // Mudar a descrição do teto é redação: conta à parte, não como falso alarme.
  assert.equal(r.redacao, 1);
  assert.equal(r.cobertura, 0);
});

test("ato sem relação: classificar como irrelevante e não propor nada", () => {
  const semRelacao = caso("ato_sem_relacao");
  const antigo = regime(semRelacao.regime);
  const certo = avaliarLeitura(semRelacao, { antigo }, { classificacao: "irrelevante", conferida: null });
  assert.deepEqual([certo.classificacaoCerta, certo.cobertura, certo.falsosAlarmes.length], [true, null, 0]);
  const errado = avaliarLeitura(semRelacao, { antigo }, { classificacao: "altera_regra", conferida: null });
  assert.equal(errado.classificacaoCerta, false);
});

// ─── Nota contra o regime conferido (LIE) ───────────────────────────────────

test("caso real: a proposta é comparada com o regime conferido à mão", () => {
  const lie = caso("lie_portaria_10_2026");
  const antigo = regime(lie.regime);
  const conferido = regime(lie.esperado.regime!);
  const proposto = structuredClone(antigo);
  const fonte = { documento: "Portaria MESP 10/2026", dispositivo: "art. 1º" };
  const aplicar = (caminho: string, valor: unknown) => {
    const r = aplicarMudanca(proposto, caminho, "alterar", valor, fonte);
    assert.ok(r.ok, `${caminho}: ${r.ok ? "" : r.motivo}`);
    return { operacao: "alterar" as const, caminho, valorAtual: null, valorProposto: valor, dispositivo: "", citacao: "", explicacao: "", aConfirmar: false };
  };
  // Seis do gabarito certos, um com valor errado; uma mudança a mais que bate
  // com o regime conferido e outra que não bate.
  const mudancas = [
    ...lie.esperado.mudancas.slice(0, 6).map(m => aplicar(m.caminho, lerCaminho(conferido, m.caminho).valor)),
    aplicar("envio.regras[codigo=arquivos].parametros.mb", 20),
    aplicar("vigenteDesde", "2026-03-04"),
    aplicar("prazos.prestacaoFinal.quantidade", 45),
  ];
  const conferida: PropostaConferida = { mudancas, descartadas: [], checagensNovas: [], regimeProposto: proposto };
  const r = avaliarLeitura(lie, { antigo, esperado: conferido }, { classificacao: "altera_regra", conferida });
  assert.equal(r.acertos.length, 6);
  assert.deepEqual(r.erradas, [{ caminho: "envio.regras[codigo=arquivos].parametros.mb", esperado: 25, proposto: 20 }]);
  assert.equal(r.extrasCertos, 1);
  assert.deepEqual(r.falsosAlarmes, [{
    caminho: "prazos.prestacaoFinal.quantidade", proposto: 45, esperado: lerCaminho(conferido, "prazos.prestacaoFinal.quantidade").valor,
  }]);
  assert.equal(Math.round(r.cobertura! * 100), 86);
  // O regime de partida que a IA recebe é o da norma anterior.
  assert.ok(regimeAchatado(antigo).includes("prazos.recurso.quantidade = 30"));
});

test("lista de opções vale sem a ordem, e texto curto sem maiúsculas", () => {
  assert.equal(mesmoValor(["parcial", "final"], ["final", "parcial"]), true);
  assert.equal(mesmoValor(["final"], ["parcial", "final"]), false);
  assert.equal(mesmoValor({ a: 1, b: [2] }, { b: [2], a: 1 }), true);
  // Opção e sigla valem sem maiúsculas e acentos.
  assert.equal(mesmoValor("TransfereGov", "Transferegov"), true);
  assert.equal(mesmoValor("isentas", "isenta"), false);
});
