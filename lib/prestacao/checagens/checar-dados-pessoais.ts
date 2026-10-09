// Dado de saúde na prestação (P9.5). Onde o regime traz a regra
// dados_de_pacientes (a saúde: minuta do Termo de Compromisso, cl. 8ª; LGPD,
// art. 5º, II, e art. 11), o motor procura pistas de dado clínico:
//  * na relação de beneficiados, nas observações, na modalidade e nos
//    benefícios (CID, prontuário, laudo, diagnóstico, doença, tratamento);
//  * nas evidências, no nome do arquivo e na descrição, só o documento
//    clínico (CID, prontuário, laudo).
// A mensagem não repete o nome de ninguém nem o trecho achado: o achado fica
// guardado nas verificações.

import { descreverPistas, ordenarPistas, pistasDosTextos, textosDaEvidencia, textosDoBeneficiado, type PistaClinica } from "../dados-sensiveis";
import { regraDoRegime } from "../regimes";
import { novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function checarDadosPessoais(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "dados_de_pacientes");
  if (!regra) return [];
  const achados: Achado[] = [];

  const pistas = new Set<PistaClinica>();
  let beneficiados = 0;
  for (const b of estado.beneficiarios ?? []) {
    const doBeneficiado = pistasDosTextos(textosDoBeneficiado(b));
    if (!doBeneficiado.length) continue;
    beneficiados += 1;
    doBeneficiado.forEach(p => pistas.add(p));
  }
  if (beneficiados) {
    const lista = ordenarPistas(pistas);
    achados.push(novoAchado(regime, {
      codigo: "DADO_CLINICO_BENEFICIADO",
      severidade: regra.severidade,
      entidade: { tipo: "prestacao", id: null },
      mensagem: `${plural(beneficiados, "beneficiado traz", "beneficiados trazem")} na relação o que parece dado de saúde (${descreverPistas(lista)}): é dado sensível e não vai à prestação. A relação conta quem foi atendido; tire o dado das observações, da modalidade e dos benefícios, ou justifique se ele precisa constar.`,
      dados: { beneficiados, pistas: lista.join(",") },
    }));
  }

  for (const e of estado.evidencias ?? []) {
    const daEvidencia = pistasDosTextos(textosDaEvidencia(e), { estrito: true });
    if (!daEvidencia.length) continue;
    achados.push(novoAchado(regime, {
      codigo: "DADO_CLINICO_EVIDENCIA",
      severidade: regra.severidade,
      entidade: { tipo: "evidencia", id: e.id },
      mensagem: `A evidência traz no nome do arquivo ou na descrição o que parece documento clínico (${descreverPistas(daEvidencia)}): prontuário, laudo e exame de paciente não vão à prestação. Tire a evidência, ou justifique se não é documento de paciente.`,
      dados: { pistas: daEvidencia.join(",") },
      justificativa: e.justificativa?.trim() || null,
    }));
  }
  return achados;
}
