import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_CHECAGENS, type DespesaDoEstado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarDespesas } from "../lib/prestacao/checagens/checar-despesas";
import { despesaDoDocumento } from "../lib/prestacao/documento-fiscal";
import { achadosDaLeituraIa, citacaoDaFonte, documentoDaLeituraIa, motivosDaIa, motivosParaMostrar } from "../lib/prestacao/leitura-ia";
import { regimePorCodigo, type RegimeNormativo } from "../lib/prestacao/regimes";
import {
  CODIGOS_DOS_MOTIVOS,
  custoDaChamada,
  ESQUEMA_DA_LEITURA,
  lerRespostaDaLeitura,
  MOTIVOS_DA_LEITURA,
  promptDaLeitura,
  usoDaResposta,
  vedadasDoRegimeJson,
  type LeituraDoComprovante,
} from "../supabase/functions/_shared/leitura-documento";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;

const leitura = (campos: Partial<LeituraDoComprovante> = {}): LeituraDoComprovante => ({
  tipo: "nfse", valor: 1000, data_doc: "2026-03-20", descricao_servico: "Gravação do álbum", numero_documento: "42", serie: null,
  chave_acesso: null, emitente: { documento: "11222333000181", nome: "Estúdio Exemplo" }, tomador: { documento: "11444777000161", nome: "Associação Exemplo" },
  retencoes: { iss: 50, inss: 0, irrf: 0, outras: 0 }, identificador_no_documento: null, item_sugerido_id: null, motivos: [], ...campos,
});

const despesa = (campos: Partial<DespesaDoEstado>): DespesaDoEstado => ({
  id: "d1", nome_arquivo: "nota.pdf", status: "pendente", no_id: null, tipo: "nfse", data_doc: "2026-10-02", valor_extraido: 1000,
  fornecedor_id: null, numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

test("todo motivo da leitura é um código do catálogo, com as mesmas regras do regime", () => {
  const catalogo = CATALOGO_CHECAGENS as Record<string, { regras?: readonly string[] }>;
  for (const codigo of CODIGOS_DOS_MOTIVOS) {
    assert.ok(catalogo[codigo], `${codigo} no catálogo`);
    assert.deepEqual([...(catalogo[codigo].regras ?? [])], [...MOTIVOS_DA_LEITURA[codigo].regras], `${codigo}: mesmas regras`);
  }
  const enumDoEsquema = (ESQUEMA_DA_LEITURA.properties.motivos.items.properties.codigo as { enum: string[] }).enum;
  assert.deepEqual(enumDoEsquema, CODIGOS_DOS_MOTIVOS, "o esquema da resposta aceita só os códigos do catálogo");
});

test("prompt com o regime: proponente, número do projeto, período, regras e vedadas; sem regime, sem vedadas", () => {
  const prompt = promptDaLeitura({
    regime: { nome: ROUANET.nome, parametros: ROUANET },
    identificador: { valor: "235678", tipo: "pronac" },
    proponente: { nome: "Associação Exemplo", documento: "11444777000161" },
    periodo: { inicio: "2026-01-01", fim: "2026-12-31" },
    itens: [{ id: "i1", nome: "Gravação", descricao: null }],
  });
  assert.match(prompt, /Regime da prestação de contas: Lei Rouanet — IN MinC 29\/2026\./);
  assert.match(prompt, /Proponente \(o tomador esperado\): Associação Exemplo, CPF\/CNPJ 11444777000161\./);
  assert.match(prompt, /Número do projeto \(pronac\): 235678\./);
  assert.match(prompt, /Período de execução: 2026-01-01 a 2026-12-31\./);
  assert.match(prompt, /- DOC_TOMADOR: quando .*Regra do regime: Documento em nome do proponente/);
  assert.match(prompt, /- PAGAMENTO_MEIO: quando .*Regra do regime: Saque, espécie, cheque e cartão/);
  assert.match(prompt, /- festas_vip: Convites, camarotes/);
  assert.match(prompt, /\[\{"id":"i1","item":"Gravação"\}\]/);
  assert.ok(vedadasDoRegimeJson(ROUANET).length > 5);

  const semRegime = promptDaLeitura({ regime: null, identificador: null, proponente: null, periodo: { inicio: null, fim: null }, itens: [] });
  assert.match(semRegime, /Regime da prestação de contas: não informado\./);
  assert.doesNotMatch(semRegime, /DESPESA_VEDADA/, "sem lista de vedadas, a IA não aponta despesa vedada");
  assert.match(semRegime, /sem orçamento cadastrado/);
});

test("resposta da IA conferida: códigos, vedadas, item, datas, retenções e documentos", () => {
  const lida = lerRespostaDaLeitura({
    tipo: "boleto", valor: 1000.456, data_doc: "20/03/2026", descricao_servico: " Gravação ", chave_acesso: "3550 3081 2112",
    emitente: { documento: "11.222.333/0001-81", nome: "Estúdio" }, tomador: null,
    retencoes: { iss: -5, inss: 110, irrf: "15" },
    identificador_no_documento: true, item_sugerido_id: "inventado",
    motivos: [
      { codigo: "DOC_TOMADOR", texto: "Em nome de Fulano." },
      { codigo: "INVENTADO", texto: "x" },
      { codigo: "DESPESA_VEDADA", texto: "Bufê.", vedada: "festas_vip" },
      { codigo: "DESPESA_VEDADA", texto: "Sem qual.", vedada: "nao_existe" },
      { codigo: "DOC_ILEGIVEL", texto: "  " },
    ],
  }, ["i1"], ["festas_vip"]);
  assert.deepEqual([lida.tipo, lida.valor, lida.data_doc, lida.descricao_servico, lida.chave_acesso], [null, 1000.46, null, "Gravação", "355030812112"]);
  assert.deepEqual(lida.emitente, { documento: "11222333000181", nome: "Estúdio" });
  assert.deepEqual(lida.tomador, { documento: null, nome: null });
  assert.deepEqual(lida.retencoes, { iss: 0, inss: 110, irrf: 0, outras: 0 }, "negativo e texto viram 0");
  assert.deepEqual([lida.identificador_no_documento, lida.item_sugerido_id], [true, null], "item fora da lista não vale");
  assert.deepEqual(lida.motivos, [
    { codigo: "DOC_TOMADOR", texto: "Em nome de Fulano." },
    { codigo: "DESPESA_VEDADA", texto: "Bufê.", vedada: "festas_vip" },
  ]);
});

test("custo por chamada: tokens do Gemini (raciocínio conta como saída) e preço do secret", () => {
  const uso = usoDaResposta({ usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 300, thoughtsTokenCount: 700, totalTokenCount: 3000 } });
  assert.deepEqual(uso, { entrada: 2000, saida: 1000, total: 3000 });
  assert.equal(custoDaChamada('{"modelo-x":[0.5,3]}', "modelo-x", uso), 0.004, "2000 × 0,5 + 1000 × 3 por milhão");
  assert.equal(custoDaChamada('{"modelo-x":[0.5,3]}', "outro", uso), null, "modelo sem preço");
  assert.equal(custoDaChamada("não é json", "modelo-x", uso), null);
  assert.equal(custoDaChamada(undefined, "modelo-x", uso), null);
  assert.deepEqual(usoDaResposta(null), { entrada: null, saida: null, total: null });
});

test("leitura da IA vira o documento do XML: chave que não confere sai, e o número do projeto vem do que a IA viu", () => {
  const { documento, avisos } = documentoDaLeituraIa(leitura({ chave_acesso: "35260311222333000181550010000012341123456789", identificador_no_documento: false }));
  assert.equal(documento.chave, null);
  assert.match(avisos[0].texto, /chave de acesso lida pela IA não confere \(O dígito verificador/);
  const contexto = { fornecedores: [{ id: "f1", documento: "11222333000181" }], proponente: { documento: "11444777000161", nome: "Associação" }, identificador: "235678", chavesUsadas: [] };
  const sugestao = despesaDoDocumento(documento, contexto);
  assert.equal(sugestao.fornecedorId, "f1");
  assert.equal(sugestao.campos.identificacao_projeto, null);
  assert.deepEqual(sugestao.avisos.map(a => a.texto), ["O número do projeto (235678) não aparece na nota."]);

  const visto = despesaDoDocumento(documentoDaLeituraIa(leitura({ identificador_no_documento: true })).documento, contexto);
  assert.equal(visto.campos.identificacao_projeto, "presente");
  const valida = documentoDaLeituraIa(leitura({ chave_acesso: "35260311222333000181550010000012341123456785" }));
  assert.deepEqual([valida.documento.chave, valida.avisos.length], ["35260311222333000181550010000012341123456785", 0]);
});

test("motivos da IA viram achados a revisar, com a fonte do regime, e nunca bloqueiam", () => {
  const motivos = [
    { codigo: "DOC_TOMADOR", texto: "Em nome de Fulano." },
    { codigo: "DESPESA_VEDADA", texto: "Bufê de coquetel.", vedada: "festas_vip" },
    { codigo: "PAGAMENTO_MEIO", texto: "Pago em dinheiro." },
    { codigo: "LIXO", texto: "x" },
  ];
  const achados = achadosDaLeituraIa(despesa({ motivos_ia: motivos as never }), ROUANET);
  assert.deepEqual(achados.map(a => [a.chave, a.severidade, a.resultado]), [
    ["DOC_TOMADOR:despesa:d1:ia", "alerta", "revisar"],
    ["DESPESA_VEDADA:despesa:d1:ia:festas_vip", "alerta", "revisar"],
    ["PAGAMENTO_MEIO:despesa:d1:ia", "alerta", "revisar"],
  ]);
  assert.equal(achados[0].mensagem, "Leitura por IA: Em nome de Fulano.");
  assert.equal(achados[0].fonte?.regra?.codigo, "em_nome_do_proponente");
  assert.equal(achados[1].fonte?.regra?.codigo, "festas_vip");
  assert.equal(citacaoDaFonte(achados[1].fonte), `${achados[1].fonte!.documento}, art. 33, § 2º, g`);

  // Um regime que faz da regra um bloqueio: a IA continua só alertando.
  const rigido = structuredClone(ROUANET) as RegimeNormativo & { pagamentos: { documentoFiscal: { codigo: string; severidade: string }[] } };
  rigido.pagamentos.documentoFiscal.find(r => r.codigo === "em_nome_do_proponente")!.severidade = "bloqueio";
  assert.equal(achadosDaLeituraIa(despesa({ motivos_ia: motivos.slice(0, 1) as never }), rigido)[0].severidade, "alerta");

  const telas = motivosParaMostrar(motivosDaIa(motivos), ROUANET);
  assert.deepEqual(telas.map(m => m.titulo), ["Documento em nome de outra pessoa", "Despesa possivelmente vedada", "Meio de pagamento"]);
  assert.deepEqual(motivosDaIa("lixo"), []);
});

test("o motor inclui os motivos da IA na despesa e para de apontar quando a pessoa descarta", () => {
  const base: EstadoDaPrestacao = { regime: null, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [] };
  const com = checarDespesas({ ...base, despesas: [despesa({ motivos_ia: [{ codigo: "DOC_ILEGIVEL", texto: "Valor borrado." }] })] });
  assert.ok(com.some(a => a.chave === "DOC_ILEGIVEL:despesa:d1:ia"));
  const sem = checarDespesas({ ...base, despesas: [despesa({ motivos_ia: [] })] });
  assert.ok(!sem.some(a => a.codigo === "DOC_ILEGIVEL"));
});
