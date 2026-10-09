// Checagens da grade horária dos recursos humanos (P8.7), escritas a partir
// da Lei de Incentivo ao Esporte:
//  * item de recursos humanos do orçamento sem cargo na grade, quando o regime
//    pede a grade de RH no envio (Portaria MESP 10/2026, art. 65, VII);
//  * mais pessoas pagas pelo item do que a grade prevê para o cargo;
//  * pessoa paga por um documento que não é o da forma de contratação da grade
//    (folha na CLT, RPA no autônomo, nota fiscal na PJ; art. 44).
// A frequência dos profissionais não fica no sistema: as horas pagas não são
// conferidas contra a grade.

import { definida } from "../regimes";
import { contratacaoDoPagamento, itensDeRh, pagosDoCargo, regimePedeGradeRh, ROTULO_DA_CONTRATACAO } from "../grade-rh";
import { novoAchado, type Achado, type EstadoDaPrestacao, type FonteDoAchado } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const DOCUMENTO = { clt: "folha de pagamento", rpa: "recibo de autônomo", pj: "nota fiscal" } as const;

export function checarRecursosHumanos(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const cargos = estado.cargos ?? [];
  const nos = estado.nos ?? [];
  const achados: Achado[] = [];
  const doc = regime ? definida(regime.envio)?.documentos.find(d => d.codigo === "grade_rh") : undefined;
  const fonteDaGrade: FonteDoAchado | null = doc ? { ...doc.fonte } : null;
  const entidade = { tipo: "prestacao" as const, id: null };
  const nomeDoNo = new Map(nos.map(n => [n.id, n.nome]));
  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  const nomeDe = (id: string) => {
    const f = fornecedores.get(id);
    return f?.nome?.trim() || f?.razao_social?.trim() || "Fornecedor sem nome";
  };

  // Item de RH sem cargo: só onde o regime pede a grade de RH.
  if (regimePedeGradeRh(regime) && nos.length) {
    const ligados = new Set(cargos.map(c => c.no_id).filter(Boolean));
    for (const item of itensDeRh(nos, estado.despesas)) {
      if (ligados.has(item.id)) continue;
      achados.push(novoAchado(regime, {
        codigo: "RH_SEM_GRADE",
        severidade: "info",
        entidade,
        ref: item.id,
        mensagem: `O item de recursos humanos "${item.nome}" não tem cargo na grade de RH: cadastre o cargo com os horários, a carga semanal e a forma de contratação, ligado ao item.`,
        dados: { item: item.nome },
        fonte: fonteDaGrade,
      }));
    }
  }

  for (const cargo of cargos) {
    if (!cargo.no_id) continue;
    const pagos = pagosDoCargo(cargo, estado.despesas, estado.fornecedores);
    const item = nomeDoNo.get(cargo.no_id) ?? cargo.cargo;
    if (pagos.length > cargo.quantidade) {
      achados.push(novoAchado(regime, {
        codigo: "RH_ACIMA_DA_GRADE",
        severidade: "alerta",
        entidade,
        ref: cargo.id,
        mensagem: `${plural(pagos.length, "pessoa foi paga", "pessoas foram pagas")} pelo item "${item}", e a grade de RH prevê ${plural(cargo.quantidade, "contratado", "contratados")} no cargo ${cargo.cargo}. Se houve substituição, explique; senão, ajuste a quantidade na grade.`,
        dados: { cargo: cargo.cargo, previstos: cargo.quantidade, pagos: pagos.length },
        fonte: fonteDaGrade,
      }));
    }
    if (!cargo.contratacao) continue;
    for (const p of pagos) {
      const outras = [...p.formas].filter(f => f !== cargo.contratacao);
      if (!outras.length) continue;
      const pelo = outras.map(f => `${DOCUMENTO[f]} (${ROTULO_DA_CONTRATACAO[f]})`).join(" e ");
      achados.push(novoAchado(regime, {
        codigo: "RH_FORMA_DE_CONTRATACAO",
        severidade: "alerta",
        entidade,
        ref: `${cargo.id}|${p.fornecedorId}`,
        mensagem: `${nomeDe(p.fornecedorId)} foi pago por ${pelo} no cargo ${cargo.cargo}, mas a grade de RH prevê ${ROTULO_DA_CONTRATACAO[cargo.contratacao]}, pago por ${DOCUMENTO[cargo.contratacao]}. Corrija a forma de contratação na grade ou o documento da despesa.`,
        dados: {
          cargo: cargo.cargo,
          prevista: ROTULO_DA_CONTRATACAO[cargo.contratacao],
          paga: outras.map(f => ROTULO_DA_CONTRATACAO[f]).join(", "),
          despesas: p.despesas.filter(d => {
            const f = contratacaoDoPagamento(d, fornecedores.get(p.fornecedorId));
            return f !== null && f !== cargo.contratacao;
          }).length,
        },
      }));
    }
  }
  return achados;
}
