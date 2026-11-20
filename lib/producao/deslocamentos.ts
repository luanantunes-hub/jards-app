// Os deslocamentos da data (plano do módulo, PD6.2): conferência do formulário com as regras do banco e o aviso de
// veículo ou motorista em dois lugares ao mesmo tempo. Sem tela e sem banco.

import { TIPOS_DE_DESLOCAMENTO, type TipoDeDeslocamento } from "@/lib/producao/estados";

export const ROTULO_DO_DESLOCAMENTO: Record<TipoDeDeslocamento, string> = {
  aviao: "Voo", onibus: "Ônibus", van: "Van", carro: "Carro", caminhao: "Caminhão", trem: "Trem", balsa: "Balsa", outro: "Outro",
};

export type DeslocamentoLido = {
  tipo: TipoDeDeslocamento; origem: string | null; destino: string | null; veiculo_id: string | null; motorista_id: string | null;
  companhia: string | null; localizador: string | null; notas: string | null;
};
export type LeituraDoDeslocamento = { ok: true; deslocamento: DeslocamentoLido } | { ok: false; erro: string };

export type CamposDoDeslocamento = {
  tipo: string; origem: string; destino: string; saida: string; chegada: string; veiculoId: string; motoristaId: string;
  companhia: string; localizador: string; notas: string;
};

const texto = (valor: string) => (valor.trim() === "" ? null : valor.trim());

/** Os textos do deslocamento como o banco aceita (origem e destino até 200, localizador até 80, notas até 2.000; chegada só com saída). */
export function lerDeslocamento(c: CamposDoDeslocamento): LeituraDoDeslocamento {
  if (!(TIPOS_DE_DESLOCAMENTO as readonly string[]).includes(c.tipo)) return { ok: false, erro: "Escolha o tipo do deslocamento." };
  if (c.chegada.trim() !== "" && c.saida.trim() === "") return { ok: false, erro: "Informe a saída antes da chegada." };
  const origem = texto(c.origem), destino = texto(c.destino), companhia = texto(c.companhia), localizador = texto(c.localizador), notas = texto(c.notas);
  if (origem && origem.length > 200) return { ok: false, erro: "A origem pode ter até 200 letras." };
  if (destino && destino.length > 200) return { ok: false, erro: "O destino pode ter até 200 letras." };
  if (companhia && companhia.length > 200) return { ok: false, erro: "A companhia pode ter até 200 letras." };
  if (localizador && localizador.length > 80) return { ok: false, erro: "O localizador pode ter até 80 letras." };
  if (notas && notas.length > 2000) return { ok: false, erro: "As notas podem ter até 2.000 letras." };
  return {
    ok: true,
    deslocamento: {
      tipo: c.tipo as TipoDeDeslocamento, origem, destino, veiculo_id: texto(c.veiculoId), motorista_id: texto(c.motoristaId),
      companhia, localizador, notas,
    },
  };
}

export type DeslocamentoParaConflito = {
  id: string; saida: string | null; chegada: string | null; veiculo_id: string | null; motorista_id: string | null; origem: string | null; destino: string | null;
  /** Quem vai (as pessoas do cadastro da equipe); sem a lista, só veículo e motorista contam. */
  pessoas_ids?: readonly string[];
};

const MINUTO = 60_000;

/** O intervalo ocupado: da saída à chegada; sem chegada, um minuto (um ponto no tempo ainda conflita com quem passa por ele). Sem saída, nada. */
function intervalo(item: DeslocamentoParaConflito): [number, number] | null {
  if (!item.saida) return null;
  const inicio = Date.parse(item.saida);
  if (!Number.isFinite(inicio)) return null;
  const fim = item.chegada ? Date.parse(item.chegada) : inicio + MINUTO;
  return [inicio, Number.isFinite(fim) && fim > inicio ? fim : inicio + MINUTO];
}

const trecho = (item: DeslocamentoParaConflito) => [item.origem, item.destino].filter(Boolean).join(" → ");

/**
 * O que se cruza: o mesmo veículo, o mesmo motorista ou a mesma pessoa em dois deslocamentos de horários que se sobrepõem (um que
 * começa quando o outro termina não conflita). Devolve, por deslocamento, os avisos prontos; só avisa, não impede.
 */
export function conflitosDeDeslocamentos(
  itens: readonly DeslocamentoParaConflito[], nomes: { veiculos: ReadonlyMap<string, string>; pessoas: ReadonlyMap<string, string> },
): Map<string, string[]> {
  const avisos = new Map<string, string[]>();
  const incluir = (id: string, aviso: string) => avisos.set(id, [...(avisos.get(id) ?? []), aviso]);
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i], ia = intervalo(a);
    if (!ia) continue;
    for (let j = i + 1; j < itens.length; j++) {
      const b = itens[j], ib = intervalo(b);
      if (!ib || !(ia[0] < ib[1] && ib[0] < ia[1])) continue;
      if (a.veiculo_id && a.veiculo_id === b.veiculo_id) {
        const nome = nomes.veiculos.get(a.veiculo_id) ?? "O veículo";
        incluir(a.id, `${nome} também está em outro deslocamento nesse horário${trecho(b) ? ` (${trecho(b)})` : ""}.`);
        incluir(b.id, `${nome} também está em outro deslocamento nesse horário${trecho(a) ? ` (${trecho(a)})` : ""}.`);
      }
      if (a.motorista_id && a.motorista_id === b.motorista_id) {
        const nome = nomes.pessoas.get(a.motorista_id) ?? "O motorista";
        incluir(a.id, `${nome} também dirige outro deslocamento nesse horário${trecho(b) ? ` (${trecho(b)})` : ""}.`);
        incluir(b.id, `${nome} também dirige outro deslocamento nesse horário${trecho(a) ? ` (${trecho(a)})` : ""}.`);
      }
      const emComum = (a.pessoas_ids ?? []).filter(pessoa => (b.pessoas_ids ?? []).includes(pessoa));
      for (const pessoa of emComum) {
        const nome = nomes.pessoas.get(pessoa) ?? "Uma pessoa";
        incluir(a.id, `${nome} também está em outro deslocamento nesse horário${trecho(b) ? ` (${trecho(b)})` : ""}.`);
        incluir(b.id, `${nome} também está em outro deslocamento nesse horário${trecho(a) ? ` (${trecho(a)})` : ""}.`);
      }
    }
  }
  return avisos;
}

/** O aviso de lotação: vão mais pessoas do que o veículo tem de lugares (sem o número de lugares, ou sem passar dele, não há aviso). */
export function avisoDeLotacao(lugares: number | null, vao: number): string | null {
  if (lugares === null || vao <= lugares) return null;
  return `Vão ${vao} ${vao === 1 ? "pessoa" : "pessoas"} e o veículo tem ${lugares} ${lugares === 1 ? "lugar" : "lugares"}.`;
}
