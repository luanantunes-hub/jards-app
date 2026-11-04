// A casca da folha sem internet (PD1.13): guarda a página /minha-folha e os arquivos estáticos do app para ela
// abrir de novo com o celular sem sinal. Os DADOS não passam por aqui: ficam no próprio celular, por usuário,
// em localStorage (lib/producao/folha-cache.ts), e o service worker nunca guarda resposta do banco nem de /api.
// Escopo: só /minha-folha (registrado em app/minha-folha/page.tsx).

const VERSAO = "folha-v1";
const PAGINA = "/minha-folha";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", evento => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome !== VERSAO) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", evento => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // o banco (Supabase) é de outra origem: nunca guardado

  // A página: tenta a rede e guarda a cópia; sem rede, entrega a última.
  if (pedido.mode === "navigate" && url.pathname === PAGINA) {
    evento.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const resposta = await fetch(pedido);
        if (resposta.ok && !resposta.redirected) await cache.put(PAGINA, resposta.clone());
        return resposta;
      } catch {
        return (await cache.match(PAGINA)) ?? Response.error();
      }
    })());
    return;
  }

  // Os arquivos do app (o nome tem a impressão digital, então nunca mudam): do cache, ou da rede e guarda.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      const guardado = await cache.match(pedido);
      if (guardado) return guardado;
      const resposta = await fetch(pedido);
      if (resposta.ok) await cache.put(pedido, resposta.clone());
      return resposta;
    })());
  }
});
