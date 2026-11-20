import "server-only";
import dns from "node:dns";
import https from "node:https";
import { resolverSemRedeInterna, TEMPO_MAXIMO_DO_ENVIO_MS } from "@/lib/ticketeria/webhooks";
import type { Transporte } from "@/lib/ticketeria/webhooks-envio";

// O transporte de verdade dos webhooks: um POST por https que NUNCA chega a rede interna. O nome é resolvido por uma função própria (resolverSemRedeInterna) que recusa qualquer endereço
// privado ou reservado, e o MESMO endereço resolvido é o que a conexão usa (assim, trocar o DNS entre a conferência e a conexão não adianta). Não segue redirecionamento, limita o tempo e descarta a resposta.

export const transporteHttps: Transporte = (url, cabecalhos, corpo) => new Promise((resolve, reject) => {
  const alvo = new URL(url);
  if (alvo.protocol !== "https:") { reject(new Error("endereco_interno")); return; }
  const pedido = https.request({
    protocol: "https:", hostname: alvo.hostname, port: alvo.port || 443, path: `${alvo.pathname}${alvo.search}`, method: "POST",
    headers: { ...cabecalhos, "content-length": String(Buffer.byteLength(corpo)) },
    lookup: resolverSemRedeInterna(host => dns.promises.lookup(host, { all: true })) as unknown as https.RequestOptions["lookup"], timeout: TEMPO_MAXIMO_DO_ENVIO_MS, rejectUnauthorized: true,
  }, resposta => {
    resposta.resume();
    resposta.on("end", () => resolve({ status: resposta.statusCode ?? 0 }));
    resposta.on("error", reject);
  });
  pedido.on("timeout", () => pedido.destroy(new Error("tempo_esgotado")));
  pedido.on("error", reject);
  pedido.end(corpo);
});
