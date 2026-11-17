// Proxy de medição entre o Vexa e a Groq (plano-reunioes-transcricao.md, fase 1).
//
// O Vexa fala com qualquer servidor de transcrição compatível com a OpenAI (TRANSCRIPTION_SERVICE_URL). Este programa fica no meio: repassa cada pedido à Groq sem
// mexer em nada e anota, num arquivo, quantos segundos de áudio cada pedido tinha e quanto a Groq vai faturar. Assim se descobre, na primeira reunião de teste,
// se o Vexa manda o mesmo áudio mais de uma vez e quanto custa de verdade a hora de reunião.
//
// Subir (a chave fica só no ambiente; nunca em arquivo do repositório):
//   GROQ_API_KEY=... npx tsx scripts/reunioes-spike/proxy-groq.ts            (porta 8090; PORTA=... muda)
// No Vexa: TRANSCRIPTION_SERVICE_URL=http://<onde-o-proxy-roda>:8090  e  TRANSCRIPTION_MODEL=whisper-large-v3-turbo
// Resumo depois da reunião (duração real em minutos):
//   npx tsx scripts/reunioes-spike/proxy-groq.ts --resumo medicoes.jsonl --reuniao-min 30

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { duracaoDoWav, faturadoEmSegundos, resumoDaMedicao, type PedidoMedido } from "./medidas";

const GROQ = process.env.GROQ_URL ?? "https://api.groq.com/openai/v1/audio/transcriptions"; // GROQ_URL só serve para testar com um servidor de mentira
const ARQUIVO = process.env.MEDICOES ?? "medicoes.jsonl";

/** O conteúdo do campo "file" de um corpo multipart (sem biblioteca: procura a parte pelo nome e devolve os bytes dela). */
function arquivoDoMultipart(corpo: Buffer, contentType: string): Uint8Array | null {
  const limite = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!limite) return null;
  const marca = Buffer.from(`--${limite[1] ?? limite[2]}`);
  let inicio = corpo.indexOf(marca);
  while (inicio !== -1) {
    const fimDoCabecalho = corpo.indexOf("\r\n\r\n", inicio);
    const proxima = corpo.indexOf(marca, inicio + marca.length);
    if (fimDoCabecalho === -1) return null;
    const cabecalho = corpo.subarray(inicio, fimDoCabecalho).toString("latin1");
    if (/name="file"/i.test(cabecalho)) {
      const dados = corpo.subarray(fimDoCabecalho + 4, proxima === -1 ? corpo.length : proxima - 2);
      return new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength);
    }
    inicio = proxima;
  }
  return null;
}

function resumir() {
  const alvo = process.argv[process.argv.indexOf("--resumo") + 1];
  const reuniao = process.argv.includes("--reuniao-min") ? Number(process.argv[process.argv.indexOf("--reuniao-min") + 1]) : null;
  if (!alvo || !existsSync(alvo)) { console.error("Informe o arquivo de medições: --resumo medicoes.jsonl [--reuniao-min 30]"); process.exit(1); }
  const pedidos = readFileSync(alvo, "utf8").split("\n").filter(Boolean).map(linha => JSON.parse(linha) as PedidoMedido & { status: number });
  const feitos = pedidos.filter(pedido => pedido.status === 200);
  const r = resumoDaMedicao(feitos, reuniao && reuniao > 0 ? reuniao : null);
  console.log(`Pedidos com sucesso: ${r.pedidos} (de ${pedidos.length} no arquivo; ${r.estimados} com duração estimada pelo tamanho)`);
  console.log(`Segundos faturados: ${Math.round(r.faturadoS)} (${(r.faturadoS / 60).toFixed(1)} min); custo na Groq: US$ ${r.custoDolares.toFixed(4)}`);
  if (r.vezesCobrado !== null) {
    console.log(`Vezes que o áudio foi cobrado: ${r.vezesCobrado.toFixed(2)}x a duração da reunião`);
    console.log(`Custo por hora de reunião: US$ ${(r.custoPorHoraDeReuniao as number).toFixed(4)}; por 100 horas: US$ ${(r.custoPor100Horas as number).toFixed(2)}`);
  }
}

function servir() {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) { console.error("Defina GROQ_API_KEY no ambiente."); process.exit(1); }
  const porta = Number(process.env.PORTA ?? 8090);
  createServer(async (pedido, resposta) => {
    if (pedido.method === "GET" && pedido.url === "/health") { resposta.writeHead(200).end("ok"); return; }
    if (pedido.method !== "POST" || !pedido.url?.endsWith("/audio/transcriptions")) { resposta.writeHead(404).end("só /v1/audio/transcriptions"); return; }
    const partes: Buffer[] = [];
    for await (const parte of pedido) partes.push(parte as Buffer);
    const corpo = Buffer.concat(partes);
    const tipo = String(pedido.headers["content-type"] ?? "");
    const audio = arquivoDoMultipart(corpo, tipo);
    const duracao = audio ? duracaoDoWav(audio) : null;
    const fatura = faturadoEmSegundos(duracao, audio?.byteLength ?? corpo.byteLength);
    const comeco = Date.now();
    const saida = await fetch(GROQ, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": tipo }, body: new Uint8Array(corpo) });
    const texto = await saida.text();
    appendFileSync(ARQUIVO, JSON.stringify({
      em: new Date().toISOString(), bytes: audio?.byteLength ?? corpo.byteLength, duracaoS: duracao, faturadoS: fatura.segundos, estimado: fatura.estimado, status: saida.status, ms: Date.now() - comeco,
    }) + "\n");
    resposta.writeHead(saida.status, { "Content-Type": saida.headers.get("content-type") ?? "application/json" }).end(texto);
  }).listen(porta, () => console.log(`Proxy de medição na porta ${porta}; anotando em ${ARQUIVO}`));
}

if (process.argv.includes("--resumo")) resumir(); else servir();
