// Gravação do formulário PCP/PCF 2026 da LIE sobre o modelo (P8.2).
//
// O modelo é o arquivo oficial da DPPIE convertido para .xlsx
// (public/modelos/lie/formulario-pcp-pcf-2026.xlsx): mesmas abas, células,
// estilos, logotipo e fórmulas. Cada bloco de linhas cresce quando a prestação
// tem mais linhas que o modelo, inserindo antes da última linha do bloco para
// que os totais (SUM) incluam as novas. Sem React e sem Supabase.

import { PastaDeTrabalho, type Planilha } from "../xlsx-modelo";
import { BLOCOS, type FormularioLie } from "./formulario-lie";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valor = (c: number) => Math.round(c) / 100;

/** Células do marcador PARCIAL ( ) e FINAL ( ) de cada aba (regra marcador_parcial_final). */
const MARCADORES: readonly [string, string, string][] = [
  ["RECEITA E DESPESA", "E1", "E2"], ["EXECUTADO", "J1", "J2"], ["PAGAMENTOS", "H1", "H2"], ["RECURSOS HUMANOS", "I1", "I2"],
  ["BENEFICIADOS", "M1", "M2"], ["BENS ADQUIRIDOS", "G1", "G2"], ["DIÁRIAS", "K1", "K2"],
];

/** Onde vão o projeto, o SLI e o proponente em cada aba. */
const CABECALHOS: Record<string, { projeto: string; sli: string; proponente: string }> = {
  "RECEITA E DESPESA": { projeto: "A4", sli: "E4", proponente: "A5" },
  EXECUTADO: { projeto: "E4", sli: "G5", proponente: "A4" },
  PAGAMENTOS: { projeto: "A4", sli: "H4", proponente: "A5" },
  "RECURSOS HUMANOS": { projeto: "A4", sli: "I4", proponente: "A5" },
  BENEFICIADOS: { projeto: "A4", sli: "M4", proponente: "A5" },
  GRADE: { projeto: "A4", sli: "G6", proponente: "A5" },
  EVENTOS: { projeto: "A4", sli: "G6", proponente: "A5" },
  "A EXECUTAR": { projeto: "A4", sli: "L3", proponente: "A3" },
  "BENS ADQUIRIDOS": { projeto: "A4", sli: "G4", proponente: "A5" },
  DIÁRIAS: { projeto: "A4", sli: "J4", proponente: "A5" },
};

function marcar(p: Planilha, ref: string, marcado: boolean) {
  const texto = String(p.ler(ref) ?? "");
  p.escrever(ref, texto.replace(/\(\s*X?\s*\)/i, marcado ? "(X)" : "(  )"));
}

/** Garante `n` linhas no bloco, inserindo antes da última com o estilo da penúltima; devolve quantas entraram. */
function garantir(pasta: PastaDeTrabalho, aba: string, bloco: { primeira: number; ultima: number }, n: number): number {
  const extra = Math.max(0, n - (bloco.ultima - bloco.primeira + 1));
  pasta.inserirLinhas(aba, bloco.ultima, extra, bloco.ultima - 1);
  return extra;
}

export async function gravarFormularioLie(modelo: Uint8Array, f: FormularioLie): Promise<Uint8Array> {
  const pasta = await PastaDeTrabalho.abrir(modelo);
  const c = f.cabecalho;

  for (const [aba, refs] of Object.entries(CABECALHOS)) {
    const p = pasta.planilha(aba);
    p.completar(refs.projeto, c.projeto);
    p.completar(refs.sli, c.sli);
    p.completar(refs.proponente, c.proponente);
  }
  for (const [aba, parcial, final] of MARCADORES) {
    const p = pasta.planilha(aba);
    marcar(p, parcial, f.etapa === "parcial");
    marcar(p, final, f.etapa === "final");
  }

  // RECEITA E DESPESA
  {
    const b = BLOCOS.receitaDespesa;
    garantir(pasta, "RECEITA E DESPESA", b, Math.max(f.receitas.length, f.despesas.length));
    const p = pasta.planilha("RECEITA E DESPESA");
    f.receitas.forEach((r, i) => { p.escrever(`A${b.primeira + i}`, r.descricao); p.escrever(`C${b.primeira + i}`, valor(r.valor)); });
    f.despesas.forEach((d, i) => { p.escrever(`D${b.primeira + i}`, d.descricao); p.escrever(`E${b.primeira + i}`, valor(d.valor)); });
  }

  // EXECUTADO
  {
    const b = BLOCOS.executado;
    const p = pasta.planilha("EXECUTADO");
    p.completar("A5", reais(c.captado));
    p.completar("C5", reais(c.rendimentos));
    p.completar("I5", c.vigencia);
    garantir(pasta, "EXECUTADO", b, f.itens.length);
    f.itens.forEach((item, i) => {
      const r = b.primeira + i;
      p.escrever(`A${r}`, item.codigo);
      p.escrever(`B${r}`, item.nome);
      p.escrever(`D${r}`, item.unidade);
      p.escrever(`E${r}`, item.quantidade);
      p.escrever(`G${r}`, valor(item.programado));
      p.escrever(`H${r}`, valor(item.executado));
      p.escrever(`J${r}`, valor(item.executado));
    });
  }

  // PAGAMENTOS
  {
    const b = BLOCOS.pagamentos;
    garantir(pasta, "PAGAMENTOS", b, f.pagamentos.length);
    const p = pasta.planilha("PAGAMENTOS");
    f.pagamentos.forEach((x, i) => {
      const r = b.primeira + i;
      p.escrever(`A${r}`, x.acao);
      p.escrever(`B${r}`, x.credor);
      p.escrever(`C${r}`, x.documento);
      p.escrever(`D${r}`, x.cheque);
      p.escrever(`E${r}`, x.dataCheque);
      p.escrever(`F${r}`, x.titulo);
      p.escrever(`G${r}`, x.dataTitulo);
      p.escrever(`H${r}`, valor(x.valor));
    });
  }

  // RECURSOS HUMANOS
  {
    const b = BLOCOS.recursosHumanos;
    garantir(pasta, "RECURSOS HUMANOS", b, f.recursosHumanos.length);
    const p = pasta.planilha("RECURSOS HUMANOS");
    f.recursosHumanos.forEach((x, i) => {
      const r = b.primeira + i;
      p.escrever(`A${r}`, i + 1);
      p.escrever(`B${r}`, x.nome);
      p.escrever(`C${r}`, x.documento);
      p.escrever(`D${r}`, x.funcao);
      // A coluna do modelo não tem formato de moeda nem total: o valor vai escrito.
      p.escrever(`G${r}`, reais(x.valor));
      p.escrever(`I${r}`, x.periodo);
    });
  }

  // A EXECUTAR: o exemplo do modelo sai; as ações entram só na PCP.
  {
    const p = pasta.planilha("A EXECUTAR");
    const fim = f.acoes.filter(a => a.divisao === "fim");
    const meio = f.acoes.filter(a => a.divisao === "meio");
    const elaboracao = f.acoes.filter(a => a.divisao === "elaboracao").reduce((s, a) => s + a.programado, 0);
    const bf = BLOCOS.aExecutarFim, bm = BLOCOS.aExecutarMeio;
    p.limpar(`B${bf.primeira}:K${bf.ultima}`);
    p.limpar(`B${bm.primeira}:K${bm.ultima}`);
    p.limpar("C37:K37");
    p.completar("A6", c.vigencia);
    if (f.etapa === "parcial") {
      const extraFim = garantir(pasta, "A EXECUTAR", bf, fim.length);
      const meioBloco = { primeira: bm.primeira + extraFim, ultima: bm.ultima + extraFim };
      const extraMeio = garantir(pasta, "A EXECUTAR", meioBloco, meio.length);
      const escrever = (lista: typeof fim, primeira: number) => lista.forEach((a, i) => {
        p.escrever(`A${primeira + i}`, a.codigo);
        p.escrever(`B${primeira + i}`, a.nome);
        p.escrever(`C${primeira + i}`, valor(a.programado));
      });
      escrever(fim, bf.primeira);
      escrever(meio, meioBloco.primeira);
      p.escrever(`C${37 + extraFim + extraMeio}`, elaboracao ? valor(elaboracao) : null);
    }
  }

  // BENS ADQUIRIDOS
  {
    const b = BLOCOS.bens;
    garantir(pasta, "BENS ADQUIRIDOS", b, f.bens.length);
    const p = pasta.planilha("BENS ADQUIRIDOS");
    f.bens.forEach((x, i) => {
      const r = b.primeira + i;
      p.escrever(`A${r}`, x.acao);
      p.escrever(`B${r}`, x.item);
      p.escrever(`C${r}`, x.origem);
      p.escrever(`E${r}`, x.destinacao);
      p.escrever(`F${r}`, x.data);
      p.escrever(`G${r}`, valor(x.valor));
    });
  }

  return pasta.gravar();
}
