// Consentimento de cookies de análise e de publicidade (LGPD, art. 7º, I).
// O Google Analytics e a tag do Google Ads (medição das campanhas e
// remarketing) só são carregados depois que o visitante aceita; sem escolha
// gravada, o aviso aparece. Usado nas páginas públicas: landing, blog, Termos,
// Política, cadastro e a volta do pagamento. Qualquer elemento com
// [data-preferencias-cookies] reabre o aviso.
(function () {
  if (window.jardsCookies) return;

  var GA_ID = "G-JWVV7GT45S";
  var ADS_ID = "AW-18498679750";
  var CHAVE = "jards_consentimento_cookies";
  // Versão 2: o aceite passou a incluir cookies de publicidade; quem aceitou a
  // versão 1 vê o aviso de novo.
  var VERSAO = 2;
  var TUDO_PERMITIDO = { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };
  var TUDO_NEGADO = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  var gaCarregado = false;
  var aviso = null;
  var historicoNativo = { pushState: history.pushState, replaceState: history.replaceState };

  function ehPublica(caminho) {
    return caminho === "/" || caminho === "/privacidade" || caminho === "/termos" || caminho === "/incentivadores" || caminho === "/crm" || caminho === "/precos" ||
      caminho === "/blog" || caminho.indexOf("/blog/") === 0 ||
      caminho === "/cadastro" || caminho.indexOf("/cadastro/") === 0 ||
      caminho === "/assinatura/concluida";
  }

  function lerEscolha() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE));
      if (v && v.versao === VERSAO && typeof v.analytics === "boolean") return v;
    } catch (e) {}
    return null;
  }

  function gravarEscolha(analytics) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO, analytics: analytics, em: new Date().toISOString() }));
    } catch (e) {}
  }

  // Da URL só seguem o endereço e os parâmetros de campanha.
  function enderecoLimpo() {
    var campanha = new URLSearchParams();
    new URLSearchParams(location.search).forEach(function (valor, nome) {
      if (/^utm_/.test(nome) || /^(gclid|gbraid|wbraid)$/.test(nome)) campanha.append(nome, valor);
    });
    var q = campanha.toString();
    return location.origin + location.pathname + (q ? "?" + q : "");
  }

  // Da origem da visita, só o domínio.
  function referenciaLimpa(ref) {
    try { return new URL(ref).origin + "/"; } catch (e) { return ""; }
  }

  function ativarAnalytics() {
    if (!ehPublica(location.pathname)) return;
    window["ga-disable-" + GA_ID] = false;
    if (gaCarregado) {
      window.gtag("consent", "update", TUDO_PERMITIDO);
      return;
    }
    gaCarregado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", TUDO_PERMITIDO);
    window.gtag("js", new Date());
    limparEnderecoVisivel();
    window.gtag("config", GA_ID, {
      page_location: enderecoLimpo(),
      page_referrer: referenciaLimpa(document.referrer),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    window.gtag("config", ADS_ID, {
      page_location: enderecoLimpo(),
      page_referrer: referenciaLimpa(document.referrer),
    });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  // Com o GA ativo, o endereço exibido perde os parâmetros que não são de
  // campanha. A medição aprimorada lê a URL do navegador a cada mudança de
  // histórico; assim ela nunca vê parâmetros arbitrários.
  function limparEnderecoVisivel() {
    var limpo = enderecoLimpo() + location.hash;
    if (limpo !== location.href) historicoNativo.replaceState.call(history, history.state, "", limpo);
  }

  function apagarCookiesAnalytics() {
    var partes = location.hostname.split(".");
    document.cookie.split(";").forEach(function (c) {
      var nome = c.split("=")[0].trim();
      if (!/^(_ga(_|$)|_gid$|_gat|_gcl_)/.test(nome)) return;
      document.cookie = nome + "=; Max-Age=0; path=/";
      for (var i = 0; i < partes.length - 1; i++) {
        document.cookie = nome + "=; Max-Age=0; path=/; domain=." + partes.slice(i).join(".");
      }
    });
  }

  // A tag do Google Ads não tem desligamento próprio: com as tags já
  // carregadas, a recusa recarrega a página, que volta sem nenhuma delas.
  function desativarAnalytics() {
    window["ga-disable-" + GA_ID] = true;
    apagarCookiesAnalytics();
    if (gaCarregado) {
      window.gtag("consent", "update", TUDO_NEGADO);
      location.reload();
    }
  }

  // O GA só pode existir nas páginas públicas. Se uma navegação sem recarga
  // (Next.js) levar a outra rota, o GA é desligado e a página é recarregada
  // por inteiro, já sem ele. Entre páginas públicas, o endereço é limpo.
  function sairSemAnalytics(url) {
    window["ga-disable-" + GA_ID] = true;
    location.assign(url);
  }

  ["pushState", "replaceState"].forEach(function (metodo) {
    var original = history[metodo];
    history[metodo] = function (estado, titulo, url) {
      if (gaCarregado && url != null) {
        var destino = new URL(url, location.href);
        if (destino.origin === location.origin && !ehPublica(destino.pathname)) {
          sairSemAnalytics(destino.href);
          return;
        }
      }
      var resultado = original.apply(this, arguments);
      if (gaCarregado) limparEnderecoVisivel();
      return resultado;
    };
  });

  window.addEventListener("popstate", function () {
    if (!gaCarregado) return;
    if (!ehPublica(location.pathname)) sairSemAnalytics(location.href);
    else limparEnderecoVisivel();
  });

  var CSS =
    // Faixa escura e compacta, centralizada no rodapé: texto pequeno à esquerda, escolha à direita.
    ".jc-aviso{position:fixed;left:16px;right:16px;bottom:16px;z-index:90;max-width:920px;margin:0 auto;box-sizing:border-box;" +
    "display:flex;align-items:center;gap:12px 20px;padding:10px 10px 10px 18px;" +
    "background:rgba(40,37,37,.94);color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:8px;box-shadow:0 12px 32px rgba(40,37,37,.22);" +
    "-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);" +
    "font-family:inherit;font-size:12px;font-weight:400;line-height:1.45;text-align:left;animation:jc-entra .22s ease-out}" +
    ".jc-texto{flex:1;min-width:0}" +
    ".jc-aviso p{margin:0;color:rgba(255,255,255,.78);text-wrap:pretty}" +
    ".jc-aviso a{color:#fff;text-decoration:underline;text-underline-offset:2px}" +
    ".jc-atual{margin-top:2px!important;color:rgba(255,255,255,.55)!important}" +
    ".jc-acoes{display:flex;flex-shrink:0;gap:6px}" +
    ".jc-btn{height:32px;padding:0 14px;border-radius:5px;font-family:inherit;font-size:12.5px;font-weight:500;line-height:1;cursor:pointer;" +
    "transition:background-color .16s ease,border-color .16s ease,transform .16s ease}" +
    ".jc-btn:active{transform:translateY(1px)}" +
    ".jc-btn:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:2px}" +
    ".jc-recusar{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.22)}" +
    ".jc-recusar:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.34)}" +
    ".jc-aceitar{background:#fff;color:#282525;border:1px solid #fff}" +
    ".jc-aceitar:hover{background:rgba(255,255,255,.86);border-color:transparent}" +
    "@keyframes jc-entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    "@media (max-width:640px){.jc-aviso{flex-direction:column;align-items:stretch;left:12px;right:12px;bottom:12px;padding:12px}.jc-acoes .jc-btn{flex:1;height:36px}}" +
    "@media (prefers-reduced-motion:reduce){.jc-aviso{animation:none}.jc-btn{transition:none}}";

  function garantirEstilo() {
    if (document.getElementById("jc-estilo")) return;
    var st = document.createElement("style");
    st.id = "jc-estilo";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function fecharAviso() {
    if (aviso) aviso.remove();
    aviso = null;
  }

  function escolher(analytics) {
    gravarEscolha(analytics);
    if (analytics) ativarAnalytics();
    else desativarAnalytics();
    fecharAviso();
  }

  function abrirAviso(focar) {
    garantirEstilo();
    fecharAviso();
    var atual = lerEscolha();
    aviso = document.createElement("div");
    aviso.className = "jc-aviso";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Preferências de cookies");
    aviso.innerHTML =
      '<div class="jc-texto">' +
      "<p>Usamos o Google Analytics e o Google Ads para medir as visitas e o resultado das nossas campanhas, " +
      "e para mostrar nossos anúncios a quem já visitou o site. Isso grava cookies de análise e de publicidade, " +
      'e só ativamos se você aceitar. <a href="/privacidade#s10">Política de Privacidade</a></p>' +
      (atual ? '<p class="jc-atual">Escolha atual: ' + (atual.analytics ? "aceito" : "recusado") + ".</p>" : "") +
      "</div>" +
      '<div class="jc-acoes">' +
      '<button type="button" class="jc-btn jc-recusar">Recusar</button>' +
      '<button type="button" class="jc-btn jc-aceitar">Aceitar</button>' +
      "</div>";
    aviso.querySelector(".jc-recusar").addEventListener("click", function () { escolher(false); });
    aviso.querySelector(".jc-aceitar").addEventListener("click", function () { escolher(true); });
    document.body.appendChild(aviso);
    if (focar) aviso.querySelector(".jc-recusar").focus();
  }

  // Mantém este documento alinhado com a escolha gravada: na carga, quando
  // outra aba muda a escolha e quando a página volta do cache do Voltar.
  function sincronizar() {
    var escolha = lerEscolha();
    if (escolha && escolha.analytics) {
      fecharAviso();
      ativarAnalytics();
      return;
    }
    if (gaCarregado || escolha) desativarAnalytics();
    if (escolha) fecharAviso();
    else if (!aviso) abrirAviso(false);
  }

  document.addEventListener("click", function (e) {
    var alvo = e.target instanceof Element ? e.target.closest("[data-preferencias-cookies]") : null;
    if (!alvo) return;
    e.preventDefault();
    abrirAviso(true);
  });

  window.addEventListener("storage", function (e) {
    if (e.key === CHAVE || e.key === null) sincronizar();
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) sincronizar();
  });

  window.jardsCookies = { abrir: function () { abrirAviso(true); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sincronizar);
  else sincronizar();
})();
