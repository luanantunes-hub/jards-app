// Checagens dos bens permanentes (P3.5), com a fonte das regras do regime
// (Rouanet: IN 29/2026, arts. 30 e 69, VI, VII e X):
//
//  * despesa de item marcado como bem permanente sem o bem registrado;
//  * bem sem destinação declarada;
//  * bem móvel, equipamento ou obra de arte sem cotação, e pago acima da
//    menor cotação, quando o regime pede cotação ou pesquisa de preço;
//  * imóvel sem o registro (cartório, número e folha);
//  * depois do fim da execução, bem doado sem quem recebeu, o termo ou o aceite.
// São alertas: a justificativa escrita no bem vale para o achado do preço.

import { despesasSemBem, faltaNaDoacao, listaEmTexto, menorCotacao, TIPOS_BEM } from "../bens";
import { execucaoTerminou } from "../objeto";
import { regraDoRegime } from "../regimes";
import { centavos, novoAchado, reais, severidadeDaChecagem, type Achado, type EstadoDaPrestacao } from "./catalogo";

/** Regras que, em algum regime, pedem cotação ou pesquisa de preço. */
const REGRAS_DE_COTACAO = ["bens", "cotacoes", "processo_de_compra", "precos_de_referencia"];

export function checarBens(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const bens = estado.bens ?? [];
  const itensDeBem = new Set((estado.nos ?? []).filter(n => n.tipo === "item" && n.bem_permanente).map(n => n.id));
  const achados: Achado[] = [];

  for (const d of despesasSemBem(estado.despesas, itensDeBem, bens)) {
    const item = estado.nos?.find(n => n.id === d.no_id);
    achados.push(novoAchado(regime, {
      codigo: "BEM_SEM_CADASTRO",
      severidade: severidadeDaChecagem(regime, "BEM_SEM_CADASTRO", "alerta"),
      entidade: { tipo: "despesa", id: d.id },
      mensagem: `"${d.nome_arquivo ?? "Despesa"}" é do item "${item?.nome ?? "do orçamento"}", marcado como bem permanente; registre o bem com a destinação.`,
      dados: { despesa: d.nome_arquivo ?? null, item: item?.nome ?? null },
    }));
  }

  const pedeCotacao = REGRAS_DE_COTACAO.some(codigo => regraDoRegime(regime, codigo));
  const terminou = execucaoTerminou(estado.prestacao?.data_fim_execucao ?? null, estado.hoje ?? new Date());
  const valorDaDespesa = new Map(estado.despesas.map(d => [d.id, d.valor_extraido]));

  for (const b of bens) {
    const entidade = { tipo: "bem" as const, id: b.id };
    const nome = `"${b.descricao}"`;

    if (!b.destinacao) {
      achados.push(novoAchado(regime, {
        codigo: "BEM_SEM_DESTINACAO",
        severidade: severidadeDaChecagem(regime, "BEM_SEM_DESTINACAO", "alerta"),
        entidade,
        mensagem: `${nome}: declare a destinação do bem (doação, fica com o proponente ou outra).`,
      }));
    }

    if (pedeCotacao && TIPOS_BEM.find(t => t.id === b.tipo)?.pedeCotacao) {
      const menor = menorCotacao(b.cotacoes ?? []);
      if (!menor) {
        achados.push(novoAchado(regime, {
          codigo: "BEM_SEM_COTACAO",
          severidade: severidadeDaChecagem(regime, "BEM_SEM_COTACAO", "alerta"),
          entidade,
          mensagem: `${nome}: registre a cotação de preço feita antes da compra, com o comprovante.`,
        }));
      } else {
        const pago = b.despesa_id ? valorDaDespesa.get(b.despesa_id) ?? b.valor : b.valor;
        if (pago !== null && pago !== undefined && centavos(pago) > centavos(menor.valor)) {
          achados.push(novoAchado(regime, {
            codigo: "BEM_ACIMA_DA_COTACAO",
            severidade: "justificativa",
            entidade,
            mensagem: `${nome}: pago ${reais(centavos(pago))}; a menor cotação foi ${reais(centavos(menor.valor))} (${menor.fornecedor}). Explique a escolha no próprio bem.`,
            dados: { pago: Number(pago), menor: menor.valor, fornecedor: menor.fornecedor },
            justificativa: b.justificativa?.trim() || null,
          }));
        }
      }
    }

    if (b.tipo === "imovel" && !b.registro_imovel?.trim()) {
      achados.push(novoAchado(regime, {
        codigo: "BEM_IMOVEL_SEM_REGISTRO",
        severidade: severidadeDaChecagem(regime, "BEM_IMOVEL_SEM_REGISTRO", "alerta"),
        entidade,
        mensagem: `${nome}: informe o cartório, o número do registro e a folha do imóvel.`,
      }));
    }

    const falta = terminou ? faltaNaDoacao(b) : [];
    if (falta.length > 0) {
      achados.push(novoAchado(regime, {
        codigo: "BEM_DOACAO_SEM_RECIBO",
        severidade: severidadeDaChecagem(regime, "BEM_DOACAO_SEM_RECIBO", "alerta"),
        entidade,
        mensagem: `${nome} foi doado; falta ${listaEmTexto(falta)}.`,
        dados: { falta: falta.join(", ") },
      }));
    }
  }

  return achados;
}
