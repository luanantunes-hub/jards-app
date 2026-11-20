// Para onde uma verificação da prestação leva: a aba onde ela se resolve e, quando o achado é de uma despesa, meta,
// local, evidência, linha da distribuição, bem ou peça, a própria linha aberta. A tela das verificações e o conector do
// Claude e do ChatGPT usam este mesmo mapa, então o assistente manda a pessoa para onde o app mandaria.

import { destinoDaChecagem, type DestinoDaChecagem } from "@/lib/prestacao/checagens";

export const DESTINOS: Record<DestinoDaChecagem, { caminho: string; rotulo: string }> = {
  visao_geral: { caminho: "#dados-oficiais", rotulo: "Preencher dados" },
  orcamento: { caminho: "/orcamento", rotulo: "Abrir orçamento" },
  comprovantes: { caminho: "/comprovantes", rotulo: "Abrir despesas" },
  extrato: { caminho: "/extrato", rotulo: "Abrir extrato" },
  conciliacao: { caminho: "/conciliacao", rotulo: "Conciliar" },
  objeto: { caminho: "/objeto", rotulo: "Abrir objeto" },
  atividades: { caminho: "/atividades", rotulo: "Abrir atividades" },
  distribuicao: { caminho: "/distribuicao", rotulo: "Abrir distribuição" },
  bens: { caminho: "/bens", rotulo: "Abrir bens" },
  divulgacao: { caminho: "/divulgacao", rotulo: "Abrir divulgação" },
  beneficiarios: { caminho: "/beneficiarios", rotulo: "Abrir beneficiários" },
  carimbos: { caminho: "/envio/carimbos", rotulo: "Abrir carimbo e atesto" },
  devolucoes: { caminho: "/envio/devolucoes", rotulo: "Abrir devoluções" },
};

export function destinoDaVerificacao(
  prestacaoId: string,
  v: { check_codigo: string; entidade_tipo: string | null; entidade_id: string | null },
): { href: string; rotulo: string } {
  const qual = destinoDaChecagem(v.check_codigo);
  // O achado de uma despesa abre a própria despesa na aba de comprovantes.
  if (qual === "comprovantes" && v.entidade_tipo === "despesa" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/comprovantes?despesa=${v.entidade_id}`, rotulo: "Abrir despesa" };
  }
  // O achado de uma meta, de um local ou de uma evidência abre o cadastro na aba Objeto.
  if (qual === "objeto" && (v.entidade_tipo === "meta" || v.entidade_tipo === "local" || v.entidade_tipo === "evidencia") && v.entidade_id) {
    const rotulo = { meta: "Abrir meta", local: "Abrir local", evidencia: "Abrir evidência" }[v.entidade_tipo];
    return { href: `/prestacoes/${prestacaoId}/objeto?${v.entidade_tipo}=${v.entidade_id}`, rotulo };
  }
  // O achado de uma linha da distribuição abre a linha.
  if (qual === "distribuicao" && v.entidade_tipo === "distribuicao" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/distribuicao?linha=${v.entidade_id}`, rotulo: "Abrir linha" };
  }
  // O bem abre o cadastro; a despesa sem bem abre o cadastro de um bem novo para ela.
  if (qual === "bens" && v.entidade_tipo === "bem" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/bens?bem=${v.entidade_id}`, rotulo: "Abrir bem" };
  }
  if (qual === "bens" && v.entidade_tipo === "despesa" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/bens?despesa=${v.entidade_id}`, rotulo: "Registrar o bem" };
  }
  if (qual === "divulgacao" && v.entidade_tipo === "peca" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/divulgacao?peca=${v.entidade_id}`, rotulo: "Abrir peça" };
  }
  const { caminho, rotulo } = DESTINOS[qual];
  return { href: caminho.startsWith("#") ? caminho : `/prestacoes/${prestacaoId}${caminho}`, rotulo };
}
