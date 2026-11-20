// Gravação da grade horária dos recursos humanos da LIE sobre o modelo (P8.7).
//
// O modelo é o arquivo oficial da DPPIE (copy2_of_6grade_horaria_recursos_humanos.xls)
// convertido uma vez para .xlsx (public/modelos/lie/grade-horaria-rh-2026.xlsx):
// mesma aba "Cronograma Execução", logotipo, bordas e instruções. Os cargos vão
// nas linhas 7 a 12; com mais cargos, o bloco ganha linhas antes da última.
// Sem React e sem Supabase.

import { PastaDeTrabalho } from "../xlsx-modelo";
import { linhasDaGradeRh, type CargoDaGrade } from "./grade-rh";

export const BLOCO_GRADE_RH = { aba: "Cronograma Execução", primeira: 7, ultima: 12 } as const;

/** Colunas dos dias, de segunda (E) a domingo (K). */
const DIAS = ["E", "F", "G", "H", "I", "J", "K"] as const;

export type DadosDaGradeRh = { projeto: string; proponente: string; sli: string; processo?: string; cargos: readonly CargoDaGrade[] };

export async function gravarGradeRh(modelo: Uint8Array, dados: DadosDaGradeRh): Promise<Uint8Array> {
  const pasta = await PastaDeTrabalho.abrir(modelo);
  const { aba, primeira, ultima } = BLOCO_GRADE_RH;
  const linhas = linhasDaGradeRh(dados.cargos);
  const extra = Math.max(0, linhas.length - (ultima - primeira + 1));
  pasta.inserirLinhas(aba, ultima, extra, ultima - 1);

  const p = pasta.planilha(aba);
  p.completar("A2", dados.projeto);
  p.completar("A3", dados.proponente);
  p.completar("H4", dados.sli);
  p.completar("A4", dados.processo);
  linhas.forEach((l, i) => {
    const r = primeira + i;
    p.escrever(`A${r}`, l.cargo);
    p.escrever(`C${r}`, l.atribuicoes || null);
    p.escrever(`D${r}`, l.quantidade);
    l.horarios.forEach((h, d) => p.escrever(`${DIAS[d]}${r}`, h || null));
    p.escrever(`L${r}`, l.carga);
    p.escrever(`M${r}`, l.contratacao || null);
    p.escrever(`N${r}`, l.formacao || null);
  });
  return pasta.gravar();
}
