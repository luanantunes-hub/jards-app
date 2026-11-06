// A folha do dia em texto para colar no WhatsApp (plano do módulo, PD1.12): o dia em blocos, com o lugar. Só o que é de
// todos: nada de dinheiro, de chamada de uma pessoa nem de contato. Sem tela e sem banco.

import { diaDaSemana, diaEMes, ROTULO_DO_TIPO_DE_DATA } from "@/lib/producao/agenda";
import { ordenarBlocos, rotuloDaHora } from "@/lib/producao/dia";
import type { ExibicaoDoBloco } from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";

export type BlocoDoTexto = { inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; titulo: string | null; tipo: string; ordem: number };

const DIAS = { dom: "domingo", seg: "segunda-feira", ter: "terça-feira", qua: "quarta-feira", qui: "quinta-feira", sex: "sexta-feira", "sáb": "sábado" } as const;

/**
 * O texto da folha: título em negrito do WhatsApp (*assim*), o lugar e um bloco por linha ("19:00 Passagem de som").
 * O bloco sem título leva o tipo; o de hora oculta entra sem hora.
 */
export function textoDaFolha(entrada: {
  tipo: TipoData; data: string; dataFim: string | null; lugar: string; temporada: string | null; blocos: readonly BlocoDoTexto[]; fuso: string;
}): string {
  const linhas: string[] = [];
  const quando = `${ROTULO_DO_TIPO_DE_DATA[entrada.tipo]} de ${diaEMes(entrada.data)}${entrada.dataFim ? ` a ${diaEMes(entrada.dataFim)}` : ""}`;
  linhas.push(`*${quando}*`);
  const semana = DIAS[diaDaSemana(entrada.data) as keyof typeof DIAS];
  linhas.push([semana, entrada.temporada].filter(Boolean).join(" · "));
  if (entrada.lugar) linhas.push(`Local: ${entrada.lugar}`);
  const blocos = ordenarBlocos(entrada.blocos);
  if (blocos.length > 0) {
    linhas.push("", "*O dia*");
    for (const bloco of blocos) {
      const hora = rotuloDaHora(bloco, entrada.fuso);
      const titulo = (bloco.titulo ?? "").trim() || bloco.tipo;
      linhas.push(hora ? `${hora}  ${titulo}` : titulo);
    }
  }
  return linhas.join("\n");
}
