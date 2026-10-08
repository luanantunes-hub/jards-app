import assert from "node:assert/strict";
import test from "node:test";
import { executarChecagens, type Achado, type DespesaDoEstado, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { prazoDaObra } from "../lib/prestacao/mesma-obra";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import type { PrestacaoFornecedor } from "../lib/supabase/types";

// P7.4: na ANCINE, prestações da mesma obra e do mesmo objeto somam as RPs
// para a concentração por fornecedor (IN 159, art. 28, VI) e seguem o prazo
// que vence por último (Manual de Prestação de Contas v2.11, p. 9–10).

const IN159 = regimePorCodigo("ancine_in159_2021")!;

const fornecedor = (id: string, documento: string) => ({ id, documento, razao_social: `Fornecedor ${id}`, nome: null, tipo_pessoa: "pj", grupo_economico: null, parte_relacionada: false }) as unknown as PrestacaoFornecedor;

const despesa = (id: string, fornecedor_id: string, valor_extraido: number, campos: Partial<DespesaDoEstado> = {}): DespesaDoEstado => ({
  id, nome_arquivo: `${id}.pdf`, status: "pendente", no_id: "i1", tipo: "nfe", data_doc: "2026-03-01", valor_extraido,
  fornecedor_id, numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0,
  identificacao_projeto: "presente", justificativa: null, valor_liquido: null, ...campos,
});

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: IN159,
    despesas: [despesa("d1", "f1", 10_000), despesa("d2", "f2", 30_000)],
    fornecedores: [fornecedor("f1", "11222333000181"), fornecedor("f2", "22333444000155"), fornecedor("f3", "33444555000100")],
    documentosDosFornecedores: [],
    itens: [],
    pagamentos: [],
    lancamentos: [],
    ...campos,
  } as EstadoDaPrestacao;
}

const concentracao = (achados: Achado[]) => achados
  .filter(a => a.codigo === "FORNECEDOR_CONCENTRACAO")
  .map(a => [a.dados?.fornecedor, a.dados?.percentual, a.severidade]);

test("sem obra, a concentração olha só a prestação", () => {
  assert.deepEqual(concentracao(executarChecagens(estado())), [["Fornecedor f2", 75, "bloqueio"]]);
});

test("na mesma obra, a concentração soma as despesas de todas as prestações", () => {
  const obra = {
    prestacoes: [{ id: "p2", titulo: "Produção – FSA", identificador: "21-0456" }],
    despesas: [
      { ...despesa("o1", "f1", 50_000), prestacao_id: "p2" },
      { ...despesa("o2", "f3", 10_000), prestacao_id: "p2" },
      // Recusada não conta.
      { ...despesa("o3", "f2", 90_000, { status: "rejeitado" }), prestacao_id: "p2" },
    ],
  };
  const achados = executarChecagens(estado({ obra }));
  // Executado da obra: 40 mil daqui + 60 mil da outra = 100 mil; f1 tem 60 mil, f2 tem 30 mil.
  assert.deepEqual(concentracao(achados), [["Fornecedor f1", 60, "bloqueio"], ["Fornecedor f2", 30, "alerta"]]);
  const f1 = achados.find(a => a.codigo === "FORNECEDOR_CONCENTRACAO" && a.dados?.fornecedor === "Fornecedor f1")!;
  assert.match(f1.mensagem, /60% do total executado \(R\$\s100\.000,00\); o limite é 50%\. Inabilitação por até 2 anos\. Soma as 2 prestações da mesma obra\./);
  assert.equal(f1.dados?.prestacoes_da_obra, 2);
});

test("prazo da obra: vale o que vence por último", () => {
  const prestacoes = [
    { id: "a", titulo: "Produção – incentivo", prazo: "2027-03-01", prazo_final: "2027-03-01" },
    // O prazo informado à mão vale sobre o calculado.
    { id: "b", titulo: "Produção – FSA", prazo: "2027-06-30", prazo_final: "2027-01-31" },
    { id: "c", titulo: "Sem prazo", prazo: null, prazo_final: null },
  ];
  assert.deepEqual(prazoDaObra(prestacoes), { prazo: "2027-06-30", prestacao: prestacoes[1] });
  assert.equal(prazoDaObra([{ id: "x", titulo: "x", prazo: null }]), null);
});
