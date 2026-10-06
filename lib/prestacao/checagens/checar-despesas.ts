// Checagens da despesa, do fornecedor e dos pagamentos (P2.7): as mesmas que
// as telas mostram desde a P2.3 a P2.5 (lib/prestacao/despesas.ts e
// pagamentos.ts), viradas em achados com chave estável.

import { alertasDaDespesa, ehDespesa, type AlertaDespesa } from "../despesas";
import { alertasDosPagamentos } from "../pagamentos";
import { definida, type RegimeNormativo } from "../regimes";
import { CATALOGO_CHECAGENS, justificativaDaDespesa, novoAchado, type Achado, type CodigoChecagem, type DespesaDoEstado, type EstadoDaPrestacao } from "./catalogo";

// Todo código que as telas emitem tem lugar no catálogo: faltando um, a compilação falha aqui.
// (FORNECEDOR_TIPO fica de fora: é aviso de cadastro, não da despesa.)
type FaltaNoCatalogo = Exclude<Exclude<AlertaDespesa["codigo"], "FORNECEDOR_TIPO">, CodigoChecagem>;
export const CATALOGO_COBRE_OS_ALERTAS: [FaltaNoCatalogo] extends [never] ? true : FaltaNoCatalogo = true;

/** Códigos em que o aviso de nível info quer dizer que falta dado para conferir. */
const INFO_SEM_DADO = new Set<string>(["FORNECEDOR_CNAE"]);

function achadoDoAlerta(alerta: AlertaDespesa, despesa: DespesaDoEstado, regime: RegimeNormativo | null): Achado {
  const codigo = alerta.codigo as CodigoChecagem;
  const conhecido = codigo in CATALOGO_CHECAGENS;
  const severidade = alerta.nivel === "alerta" ? "alerta" : "info";
  return novoAchado(regime, {
    codigo,
    severidade,
    resultado: alerta.nivel === "info" && INFO_SEM_DADO.has(codigo) ? "nao_calculavel" : conhecido ? CATALOGO_CHECAGENS[codigo].resultado : "revisar",
    entidade: { tipo: "despesa", id: despesa.id },
    ref: alerta.ref,
    mensagem: alerta.texto,
    fonte: conhecido ? undefined : null,
    dados: { despesa: despesa.nome_arquivo, valor: despesa.valor_extraido ?? null, data: despesa.data_doc ?? null },
    // Só o que pede justificativa leva a da despesa; aviso de info não precisa.
    justificativa: justificativaDaDespesa(despesa, severidade),
  });
}

export function checarDespesas(estado: EstadoDaPrestacao): Achado[] {
  const regimePagamentos = estado.regime ? definida(estado.regime.pagamentos) : null;
  const achados: Achado[] = [];
  for (const despesa of estado.despesas) {
    if (despesa.status === "rejeitado" || !ehDespesa(despesa.tipo)) continue;
    const fornecedor = estado.fornecedores.find(f => f.id === despesa.fornecedor_id) ?? null;
    const item = estado.itens.find(i => i.id === despesa.no_id) ?? null;
    const alertas = [
      ...alertasDaDespesa({
        despesa,
        fornecedor,
        documentosDoFornecedor: estado.documentosDosFornecedores.filter(d => d.fornecedor_id === despesa.fornecedor_id),
        item: item ? { nome: item.nome, cnaes: item.cnaes, origem: item.cnaesDe } : null,
        outrasChaves: estado.despesas.filter(o => o.id !== despesa.id && o.chave_acesso && o.status !== "rejeitado").map(o => o.chave_acesso!),
        hoje: estado.hoje,
      }),
      ...alertasDosPagamentos({
        despesa,
        liquido: despesa.valor_liquido ?? despesa.valor_extraido ?? null,
        fornecedor,
        pagamentos: estado.pagamentos.filter(p => p.despesa_id === despesa.id),
        regime: regimePagamentos,
      }),
    ];
    achados.push(...alertas.map(a => achadoDoAlerta(a, despesa, estado.regime)));
  }
  return achados;
}
