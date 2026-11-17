// Medições do teste de custo de Reuniões (plano-reunioes-transcricao.md, fase 1). Funções puras, sem rede: o proxy (proxy-groq.ts) usa estas contas para dizer
// quantos segundos de áudio a Groq vai cobrar por pedido e quanto isso dá por hora de reunião.

/** Preço do whisper-large-v3-turbo na Groq por hora de áudio (página de preços da Groq, nov/2026; confira antes de usar). */
export const DOLARES_POR_HORA_DE_AUDIO = 0.04;
/** A Groq cobra no mínimo 10 segundos por pedido. */
export const MINIMO_FATURADO_S = 10;

/** Duração em segundos de um áudio WAV (cabeçalho RIFF); nulo se não for WAV legível. */
export function duracaoDoWav(audio: Uint8Array): number | null {
  if (audio.length < 44) return null;
  const texto = (inicio: number, tamanho: number) => String.fromCharCode(...audio.subarray(inicio, inicio + tamanho));
  if (texto(0, 4) !== "RIFF" || texto(8, 4) !== "WAVE") return null;
  const visao = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  let posicao = 12, bytesPorSegundo = 0;
  while (posicao + 8 <= audio.length) {
    const nome = texto(posicao, 4), tamanho = visao.getUint32(posicao + 4, true);
    if (nome === "fmt ") bytesPorSegundo = visao.getUint32(posicao + 16, true);
    if (nome === "data") {
      // Áudio gravado em fluxo pode trazer o tamanho do bloco zerado ou gigante: vale o que de fato veio.
      const real = Math.min(tamanho === 0 ? audio.length - posicao - 8 : tamanho, audio.length - posicao - 8);
      return bytesPorSegundo > 0 ? real / bytesPorSegundo : null;
    }
    posicao += 8 + tamanho + (tamanho % 2);
  }
  return null;
}

/** Quanto a Groq fatura por um pedido: a duração do áudio, com o mínimo de 10 segundos. Sem duração conhecida, estima por 16 kHz, 16 bits, mono (32.000 bytes por segundo). */
export function faturadoEmSegundos(duracaoS: number | null, bytes: number): { segundos: number; estimado: boolean } {
  const base = duracaoS ?? bytes / 32_000;
  return { segundos: Math.max(MINIMO_FATURADO_S, base), estimado: duracaoS === null };
}

export type PedidoMedido = { faturadoS: number; duracaoS: number | null; estimado: boolean };

/** O resumo da medição: segundos faturados, vezes que o mesmo áudio foi cobrado (faturado ÷ duração da reunião), custo por hora de reunião e por 100 horas. */
export function resumoDaMedicao(pedidos: readonly PedidoMedido[], duracaoDaReuniaoMin: number | null) {
  const faturadoS = pedidos.reduce((soma, pedido) => soma + pedido.faturadoS, 0);
  const custo = (faturadoS / 3600) * DOLARES_POR_HORA_DE_AUDIO;
  const reuniaoH = duracaoDaReuniaoMin ? duracaoDaReuniaoMin / 60 : null;
  return {
    pedidos: pedidos.length, faturadoS, estimados: pedidos.filter(pedido => pedido.estimado).length,
    custoDolares: custo,
    vezesCobrado: reuniaoH ? faturadoS / 3600 / reuniaoH : null,
    custoPorHoraDeReuniao: reuniaoH ? custo / reuniaoH : null,
    custoPor100Horas: reuniaoH ? (custo / reuniaoH) * 100 : null,
  };
}
