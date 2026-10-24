import { hojeEmSaoPaulo } from "@/lib/mcp/datas";

const DIA_EM_MS = 86_400_000;

function diaEmMs(dia: string): number {
  const [ano, mes, dia_] = dia.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia_);
}

/** Dias de `de` até `ate` (AAAA-MM-DD); positivo quando `ate` vem depois. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((diaEmMs(ate) - diaEmMs(de)) / DIA_EM_MS);
}

/** Depois do envio, o prazo de enviar já não corre. */
const STATUS_SEM_PRAZO_DE_ENVIO = new Set(["enviado", "aprovado", "arquivado"]);

export interface LinhaDePrestacao {
  id: string;
  titulo: string;
  status: string;
  prazo: string | null;
  prazo_final: string | null;
  prazo_final_override: string | null;
  valor_aprovado: number | string | null;
  valor_realizado: number | string | null;
  regime_id: string | null;
  identificador_oficial: string | null;
  updated_at: string | null;
}

export interface RegimeResumido {
  id: string;
  codigo: string;
  nome: string;
}

const numeroOuNulo = (valor: number | string | null): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

/** A origem do prazo importa: o calculado pelo regime e o que alguém informou à mão se tratam diferente. */
function origemDoPrazo(linha: LinhaDePrestacao): "informado" | "calculado_pelo_regime" | null {
  if (linha.prazo_final_override) return "informado";
  if (linha.prazo_final) return "calculado_pelo_regime";
  return linha.prazo ? "informado" : null;
}

/** A prestação como o assistente vê na lista: a mesma situação que a tela mostra, sem arquivo e sem dado pessoal. */
export function resumoDaPrestacao(linha: LinhaDePrestacao, regimes: ReadonlyMap<string, RegimeResumido>, origem: string, hoje: string = hojeEmSaoPaulo()) {
  const dias = linha.prazo ? diasEntre(hoje, linha.prazo) : null;
  const regime = linha.regime_id ? regimes.get(linha.regime_id) : undefined;
  return {
    id: linha.id,
    titulo: linha.titulo,
    status: linha.status,
    identificador_oficial: linha.identificador_oficial,
    regime: regime ? { codigo: regime.codigo, nome: regime.nome } : null,
    prazo: linha.prazo,
    prazo_origem: origemDoPrazo(linha),
    dias_para_o_prazo: dias,
    atrasada: dias !== null && dias < 0 && !STATUS_SEM_PRAZO_DE_ENVIO.has(linha.status),
    valor_aprovado: numeroOuNulo(linha.valor_aprovado),
    valor_realizado: numeroOuNulo(linha.valor_realizado),
    atualizada_em: linha.updated_at,
    url: `${origem}/prestacoes/${linha.id}`,
  };
}
