// Descarte dos dados pessoais depois da guarda (P9.5). Na saúde, a minuta do
// Termo de Compromisso manda guardar os documentos por 10 anos da decisão
// final (cl. 6ª, subcl. 6ª) e tratar os dados de paciente como sensíveis,
// destruídos ou devolvidos a pedido do MS (cl. 8ª); a LGPD manda eliminar o
// dado pessoal quando acaba a finalidade (arts. 15 e 16). O banco decide se
// o descarte pode acontecer (fn_prestacao_descarte_previa) e faz o descarte
// (fn_prestacao_descartar_dados_pessoais); aqui fica a mesma leitura da guarda
// para a tela, o texto do que sai e o registro do descarte em PDF. Sem React e
// sem Supabase.

import type { BlocoDoRelatorio } from "./relatorio-pdf";
import type { DescarteDeDadosPessoais, PrestacaoEnvio } from "@/lib/supabase/types";

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

type EnvioDaGuarda = Pick<PrestacaoEnvio, "etapa" | "situacao" | "guarda_ate">;

export type SituacaoDoDescarte =
  /** Sem prestação final valendo: a guarda nem começou. */
  | { fase: "sem_final" }
  /** A final valendo ainda não tem a data da guarda: falta a decisão final. */
  | { fase: "aguarda_decisao" }
  /** Algum envio ainda está em guarda (até o último dia, inclusive). */
  | { fase: "em_guarda"; ate: string }
  /** A guarda de todos os envios venceu: o descarte pode acontecer. */
  | { fase: "liberado"; guardaAte: string };

/** A mesma conta da fn_prestacao_descarte_previa: final valendo com guarda e todo envio com a guarda vencida. */
export function situacaoDoDescarte(envios: readonly EnvioDaGuarda[], hoje: string): SituacaoDoDescarte {
  const finais = envios.filter(e => e.etapa === "final" && e.situacao === "vigente");
  if (!finais.length) return { fase: "sem_final" };
  if (!finais.some(e => e.guarda_ate)) return { fase: "aguarda_decisao" };
  if (envios.some(e => !e.guarda_ate)) return { fase: "aguarda_decisao" };
  const ate = envios.map(e => e.guarda_ate as string).sort().at(-1) as string;
  return ate >= hoje ? { fase: "em_guarda", ate } : { fase: "liberado", guardaAte: ate };
}

/** O que o banco devolve na prévia. */
export type PreviaDoDescarte = { guarda_ate: string | null; beneficiarios: number; evidencias: number; arquivos: string[] };

/** O que o descarte leva, para a confirmação. */
export function textoDoQueSai(previa: Pick<PreviaDoDescarte, "beneficiarios" | "evidencias">): string[] {
  return [
    previa.evidencias
      ? `${plural(previa.evidencias, "foto, vídeo ou lista de presença sai", "fotos, vídeos e listas de presença saem")} da prestação, com o arquivo.`
      : "Nenhuma foto, vídeo ou lista de presença a tirar.",
    previa.beneficiarios
      ? `${plural(previa.beneficiarios, "beneficiado fica", "beneficiados ficam")} só com o que conta (sexo, rede, modalidade, benefícios): o nome vira "Pessoa n", e idade, telefone, endereço e observações saem.`
      : "Nenhum beneficiado com nome a anonimizar.",
    "O retrato dos envios é anonimizado do mesmo jeito; o hash de cada envio fica, como prova do que foi enviado.",
    "As mensagens das verificações que traziam nome ou dado de saúde ficam com um texto neutro.",
  ];
}

/** Erros das funções do banco e da rota, para a pessoa. */
export const ERROS_DO_DESCARTE: Record<string, string> = {
  sem_decisao_final: "A guarda conta da decisão final: registre a decisão em Após o envio.",
  em_guarda: "Algum envio ainda está em guarda: o descarte só acontece depois que a guarda de todos vencer.",
  sem_permissao: "Só quem decide na prestação (responsável ou administrador) descarta os dados pessoais.",
  prestacao_inexistente: "Prestação não encontrada.",
  arquivos: "Não foi possível apagar os arquivos das evidências; nada foi descartado. Tente de novo.",
};

export function erroDoDescarte(mensagem: string | null | undefined): string {
  const codigo = Object.keys(ERROS_DO_DESCARTE).find(c => (mensagem ?? "").includes(c));
  return codigo ? ERROS_DO_DESCARTE[codigo] : "Não foi possível descartar os dados pessoais.";
}

/** O registro do descarte, como o relatório da prestação desenha em PDF. */
export function blocosDoRegistro(e: {
  prestacao: { titulo: string; identificador: string | null; regime: string | null };
  /** Na saúde, o Termo de Compromisso entra no fundamento. */
  saude?: boolean;
  descarte: DescarteDeDadosPessoais;
  descartadoEm: string;
  por: string | null;
  geradoEm: Date;
}): BlocoDoRelatorio[] {
  const u = e.descarte.ultimo;
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return [
    { tipo: "titulo", texto: "Registro do descarte de dados pessoais" },
    {
      tipo: "pares",
      pares: [
        ["Prestação", e.prestacao.titulo],
        ...(e.prestacao.identificador ? [["Identificador oficial", e.prestacao.identificador] as [string, string]] : []),
        ...(e.prestacao.regime ? [["Regime", e.prestacao.regime] as [string, string]] : []),
        ["Guarda até", dataBr(u.guarda_ate)],
        ["Descartados em", quando(e.descartadoEm)],
        ["Por", e.por ?? u.por],
        ["Descartes feitos", String(e.descarte.vezes)],
      ],
    },
    { tipo: "secao", texto: "O que saiu" },
    {
      tipo: "lista",
      itens: [
        { texto: `${plural(u.evidencias, "foto, vídeo ou lista de presença apagada", "fotos, vídeos e listas de presença apagadas")}, ${plural(u.arquivos, "arquivo", "arquivos")} no armazenamento.` },
        { texto: `${plural(u.beneficiarios, "beneficiado anonimizado", "beneficiados anonimizados")}: nome trocado por "Pessoa n"; idade, telefone, endereço e observações apagados.` },
        { texto: `${plural(u.envios, "retrato de envio anonimizado", "retratos de envio anonimizados")}; o SHA-256 de cada envio continua o do dia do envio.` },
        ...(u.verificacoes !== undefined ? [{ texto: `${plural(u.verificacoes, "mensagem de verificação neutralizada", "mensagens de verificação neutralizadas")}.` }] : []),
      ],
    },
    { tipo: "secao", texto: "Fundamento" },
    {
      tipo: "paragrafo",
      texto: `Lei 13.709/2018 (LGPD), arts. 15 e 16: término do tratamento e eliminação dos dados pessoais depois de cumprida a finalidade.${e.saude ? " Minuta do Termo de Compromisso do Pronon e do Pronas/PCD (Editais MS 2/2025 e 3/2025), cl. 6ª, subcl. 6ª (guarda dos documentos) e cl. 8ª (dados de saúde)." : " A guarda é a do regime da prestação, contada da decisão final."}`,
    },
    { tipo: "paragrafo", suave: true, texto: `Gerado pelo Jards em ${quando(e.geradoEm.toISOString())}. Os documentos fiscais, os extratos e os arquivos anexados ao checklist de envio continuam guardados: são o que foi enviado ao órgão.` },
  ];
}
