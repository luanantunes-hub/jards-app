// Peças de divulgação (P3.6). As marcas que a peça precisa mostrar e a
// aprovação prévia vêm do regime (Rouanet: IN 29/2026, art. 21: marcas em
// todas as peças; o MinC tem 5 dias úteis para avaliar e o silêncio aprova).
// No defeso eleitoral, a publicidade institucional do governo federal fica
// vedada (Lei 9.504/1997, art. 73, VI, b): as peças usam a versão das marcas
// do período, sem a do Governo Federal. O período vem do calendário
// regulatório. Sem React e sem Supabase.

import { somarDias } from "./calendario";
import { calcularVencimento } from "./prazos";
import { definida, prazoDoRegime, type Fonte, type RegimeNormativo } from "./regimes";
import type { DivulgacaoRegime } from "./regimes/tipos";
import type { PrestacaoPeca } from "@/lib/supabase/types";

export type TipoPeca = PrestacaoPeca["tipo"];
export type StatusAprovacao = PrestacaoPeca["aprovacao_status"];

export const TIPOS_PECA: readonly { id: TipoPeca; rotulo: string }[] = [
  { id: "cartaz", rotulo: "Cartaz" },
  { id: "folder", rotulo: "Folder ou flyer" },
  { id: "banner", rotulo: "Banner ou fundo de palco" },
  { id: "programa", rotulo: "Programa" },
  { id: "convite", rotulo: "Convite" },
  { id: "anuncio", rotulo: "Anúncio impresso" },
  { id: "rede_social", rotulo: "Rede social" },
  { id: "site", rotulo: "Site" },
  { id: "video", rotulo: "Vídeo ou vinheta" },
  { id: "audio", rotulo: "Spot de rádio ou áudio" },
  { id: "placa", rotulo: "Placa de obra ou inauguração" },
  { id: "release", rotulo: "Release" },
  { id: "outro", rotulo: "Outro" },
];

export const STATUS_APROVACAO: readonly { id: StatusAprovacao; rotulo: string }[] = [
  { id: "nao_enviada", rotulo: "Não enviada" },
  { id: "enviada", rotulo: "Enviada, aguardando" },
  { id: "aprovada", rotulo: "Aprovada" },
  { id: "reprovada", rotulo: "Recusada" },
];

export const rotuloDoTipoPeca = (id: string) => TIPOS_PECA.find(t => t.id === id)?.rotulo ?? id;

/** Período do defeso eleitoral, como o calendário regulatório guarda. */
export type DefesoEleitoral = { inicio: string; fim: string; descricao: string };

/** Marca que sai das peças no defeso: a do Governo Federal. */
export const MARCA_FORA_DO_DEFESO = /governo federal/i;
export const FONTE_DO_DEFESO: Fonte = {
  documento: "Lei 9.504/1997",
  dispositivo: "art. 73, VI, b",
  citacao: "nos três meses que antecedem o pleito: [...] autorizar publicidade institucional dos atos, programas, obras, serviços e campanhas dos órgãos públicos federais",
};

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export type PecaParaChecar = Pick<PrestacaoPeca,
  "id" | "tipo" | "titulo" | "veiculacao_inicio" | "veiculacao_fim" | "marcas" | "aprovacao_status"
  | "aprovacao_enviada_em" | "aprovacao_decidida_em" | "storage_path" | "url" | "justificativa">;

/** A divulgação do regime, quando ele a define. */
export function divulgacaoDoRegime(regime: RegimeNormativo | null | undefined): DivulgacaoRegime | null {
  return regime ? definida(regime.divulgacao) : null;
}

/** Os períodos de defeso em que a peça circulou (sem fim, um dia só). */
export function defesosDaPeca(p: Pick<PecaParaChecar, "veiculacao_inicio" | "veiculacao_fim">, defesos: readonly DefesoEleitoral[]): DefesoEleitoral[] {
  if (!p.veiculacao_inicio) return [];
  const fim = p.veiculacao_fim ?? p.veiculacao_inicio;
  return defesos.filter(d => p.veiculacao_inicio! <= d.fim && fim >= d.inicio);
}

/** As marcas que a peça precisa mostrar; no defeso, sem a do Governo Federal. */
export function marcasEsperadas(regime: RegimeNormativo | null | undefined, noDefeso: boolean): string[] {
  const div = divulgacaoDoRegime(regime);
  if (!div) return [];
  return noDefeso && div.defeso ? div.marcas.filter(m => !MARCA_FORA_DO_DEFESO.test(m)) : [...div.marcas];
}

/** Marcas esperadas que a peça não mostra (sem acento nem caixa). */
export function marcasFaltando(p: Pick<PecaParaChecar, "marcas">, esperadas: readonly string[]): string[] {
  const tem = new Set((p.marcas ?? []).map(normal));
  return esperadas.filter(m => !tem.has(normal(m)));
}

export type SituacaoDaAprovacao = {
  estado: "nao_pedida" | "nao_enviada" | "aguardando" | "aprovada" | "aprovada_pelo_silencio" | "reprovada";
  /** Desde quando a peça pode circular. */
  aprovadaEm: string | null;
  /** Último dia do prazo do órgão, quando o silêncio aprova. */
  vencimento: string | null;
  texto: string;
};

/**
 * A aprovação prévia na data `hoje`: expressa, pelo silêncio do órgão depois
 * do prazo (o dia seguinte ao último dia do prazo) ou ainda aguardando.
 */
export function situacaoDaAprovacao(p: Pick<PecaParaChecar, "aprovacao_status" | "aprovacao_enviada_em" | "aprovacao_decidida_em">, regime: RegimeNormativo | null | undefined, hoje: string): SituacaoDaAprovacao {
  const div = divulgacaoDoRegime(regime);
  const pede = Boolean(div?.aprovacaoPrevia.exigida);
  if (p.aprovacao_status === "aprovada" && p.aprovacao_decidida_em) {
    return { estado: "aprovada", aprovadaEm: p.aprovacao_decidida_em, vencimento: null, texto: `Aprovada em ${dataBr(p.aprovacao_decidida_em)}` };
  }
  if (p.aprovacao_status === "reprovada" && p.aprovacao_decidida_em) {
    return { estado: "reprovada", aprovadaEm: null, vencimento: null, texto: `Recusada em ${dataBr(p.aprovacao_decidida_em)}` };
  }
  if (p.aprovacao_status === "enviada" && p.aprovacao_enviada_em) {
    const prazo = div?.aprovacaoPrevia.silencioAprova && div.aprovacaoPrevia.prazo ? prazoDoRegime(regime, div.aprovacaoPrevia.prazo) : null;
    if (prazo) {
      const vencimento = calcularVencimento(p.aprovacao_enviada_em, prazo).data;
      if (hoje > vencimento) {
        const aprovadaEm = somarDias(vencimento, 1);
        return { estado: "aprovada_pelo_silencio", aprovadaEm, vencimento, texto: `Aprovada pelo silêncio em ${dataBr(aprovadaEm)}` };
      }
      return { estado: "aguardando", aprovadaEm: null, vencimento, texto: `Enviada em ${dataBr(p.aprovacao_enviada_em)}; o órgão tem até ${dataBr(vencimento)}` };
    }
    return { estado: "aguardando", aprovadaEm: null, vencimento: null, texto: `Enviada em ${dataBr(p.aprovacao_enviada_em)}` };
  }
  return pede
    ? { estado: "nao_enviada", aprovadaEm: null, vencimento: null, texto: "Não enviada para aprovação" }
    : { estado: "nao_pedida", aprovadaEm: null, vencimento: null, texto: "O regime não pede aprovação prévia" };
}

/** "10/08/2026" ou "01/08/2026 a 10/08/2026". */
export function periodoDaVeiculacao(p: Pick<PecaParaChecar, "veiculacao_inicio" | "veiculacao_fim">): string | null {
  if (!p.veiculacao_inicio) return null;
  return p.veiculacao_fim && p.veiculacao_fim !== p.veiculacao_inicio
    ? `${dataBr(p.veiculacao_inicio)} a ${dataBr(p.veiculacao_fim)}`
    : dataBr(p.veiculacao_inicio);
}

export type CamposDaPeca = Pick<PrestacaoPeca,
  "tipo" | "titulo" | "meio" | "veiculacao_inicio" | "veiculacao_fim" | "marcas" | "aprovacao_status"
  | "aprovacao_protocolo" | "aprovacao_enviada_em" | "aprovacao_decidida_em" | "url" | "justificativa" | "observacoes">;

/** O mesmo que o banco confere, para a tela avisar antes de salvar. */
export function erroDaPeca(p: CamposDaPeca): string | null {
  if (!p.titulo.trim()) return "Dê um título à peça.";
  if (p.titulo.trim().length > 200) return "O título tem até 200 caracteres.";
  if (p.veiculacao_fim && !p.veiculacao_inicio) return "Informe o início da veiculação.";
  if (p.veiculacao_inicio && p.veiculacao_fim && p.veiculacao_fim < p.veiculacao_inicio) return "A veiculação não termina antes de começar.";
  if (p.aprovacao_status !== "nao_enviada" && !p.aprovacao_enviada_em) return "Informe quando a peça foi enviada para aprovação.";
  if ((p.aprovacao_status === "aprovada" || p.aprovacao_status === "reprovada") && !p.aprovacao_decidida_em) return "Informe a data da decisão.";
  if (p.aprovacao_decidida_em && p.aprovacao_enviada_em && p.aprovacao_decidida_em < p.aprovacao_enviada_em) return "A decisão não vem antes do envio.";
  if (p.url && !/^https?:\/\//i.test(p.url)) return "O link começa com http:// ou https://.";
  if (p.marcas.length > 12) return "Marque até 12 marcas.";
  if ((p.observacoes?.length ?? 0) > 1000) return "As observações têm até 1.000 caracteres.";
  return null;
}
