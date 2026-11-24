import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { resolverSemRedeInterna } from "@/lib/ticketeria/webhooks";
import { lerSite, robotsPermite } from "@/lib/ticketeria/imprensa-monitor";

// A leitura de um endereço da imprensa (o RSS, a página do site, a matéria), sem chegar à rede interna: o nome é resolvido pela mesma função dos webhooks (recusa endereço privado ou
// reservado, e a conexão usa o endereço conferido), cada redirecionamento é conferido de novo (até 3), o tempo e o tamanho são limitados, e o robots.txt de cada site é respeitado.
// O Jards se apresenta com um nome próprio (não finge ser um navegador).

const TEMPO_MS = 10000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECIONAMENTOS = 3;
export const AGENTE = "Mozilla/5.0 (compatible; JardsImprensa/1.0; +https://jards.com.br)";

export type Resposta = { status: number; corpo: string; url: string };

function pedir(url: string): Promise<Resposta & { local: string | null }> {
  return new Promise((resolve, reject) => {
    const alvo = new URL(url);
    const modulo = alvo.protocol === "https:" ? https : alvo.protocol === "http:" ? http : null;
    if (!modulo || !lerSite(url).ok) { reject(new Error("endereco_invalido")); return; }
    const pedido = modulo.request({
      protocol: alvo.protocol, hostname: alvo.hostname, port: alvo.port || (alvo.protocol === "https:" ? 443 : 80), path: `${alvo.pathname}${alvo.search}`, method: "GET",
      headers: { "user-agent": AGENTE, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5", "accept-encoding": "gzip, deflate, br" },
      lookup: resolverSemRedeInterna(host => dns.promises.lookup(host, { all: true })) as unknown as https.RequestOptions["lookup"], timeout: TEMPO_MS,
    }, resposta => {
      const status = resposta.statusCode ?? 0;
      if (status >= 300 && status < 400 && resposta.headers.location) { resposta.resume(); resolve({ status, corpo: "", url, local: new URL(resposta.headers.location, url).toString() }); return; }
      const codificacao = String(resposta.headers["content-encoding"] ?? "").toLowerCase();
      const fluxo = codificacao === "gzip" ? resposta.pipe(zlib.createGunzip()) : codificacao === "deflate" ? resposta.pipe(zlib.createInflate()) : codificacao === "br" ? resposta.pipe(zlib.createBrotliDecompress()) : resposta;
      const pedacos: Buffer[] = [];
      let tamanho = 0;
      fluxo.on("data", (p: Buffer) => { tamanho += p.length; if (tamanho > MAX_BYTES) { pedido.destroy(new Error("grande_demais")); return; } pedacos.push(p); });
      fluxo.on("end", () => resolve({ status, corpo: Buffer.concat(pedacos).toString("utf8"), url, local: null }));
      fluxo.on("error", reject);
    });
    pedido.on("timeout", () => pedido.destroy(new Error("tempo_esgotado")));
    pedido.on("error", reject);
    pedido.end();
  });
}

/** GET com os redirecionamentos conferidos um a um. */
export async function ler(url: string): Promise<Resposta> {
  let atual = url;
  for (let i = 0; i <= MAX_REDIRECIONAMENTOS; i++) {
    const r = await pedir(atual);
    if (!r.local) return { status: r.status, corpo: r.corpo, url: atual };
    atual = r.local;
  }
  throw new Error("redirecionamentos_demais");
}

/** O robots.txt de cada site, lido uma vez por rodada (o cache vive só dentro de uma leitura). Sem robots.txt (ou erro ao ler), pode. */
export function porteiroDoRobots(): (url: string) => Promise<boolean> {
  const cache = new Map<string, Promise<string>>();
  return async url => {
    const u = new URL(url);
    const origem = `${u.protocol}//${u.host}`;
    if (!cache.has(origem)) cache.set(origem, ler(`${origem}/robots.txt`).then(r => (r.status === 200 ? r.corpo : ""), () => ""));
    return robotsPermite(await (cache.get(origem) as Promise<string>), `${u.pathname}${u.search}`);
  };
}
