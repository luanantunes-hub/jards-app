// Leva os parâmetros de campanha (utm) e o identificador do clique do anúncio
// (gclid) da página inicial para o cadastro, pelo endereço dos links.
// Nada é gravado no navegador: o cadastro decide o que fica com a conta
// (ver lib/origem-cadastro.ts).
(function () {
  var NOMES = /^(utm_(source|medium|campaign|term|content)|gclid|gbraid|wbraid)$/;

  function campanha() {
    var p = new URLSearchParams();
    new URLSearchParams(location.search).forEach(function (valor, nome) {
      if (NOMES.test(nome) && valor) p.set(nome, valor.slice(0, 200));
    });
    return p;
  }

  function levar(link) {
    var p = campanha();
    if (!p.toString()) return;
    var href = link.getAttribute("href");
    if (!href) return;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || url.pathname !== "/cadastro") return;
    p.forEach(function (valor, nome) {
      if (!url.searchParams.has(nome)) url.searchParams.set(nome, valor);
    });
    link.setAttribute("href", url.pathname + url.search + url.hash);
  }

  // A landing reescreve os links da aplicação com o endereço completo
  // ([data-app-path]), então o filtro é pela URL resolvida, não pelo texto.
  function levarTodos() {
    document.querySelectorAll("a[href]").forEach(levar);
  }

  // Links criados depois da carga também levam a campanha.
  document.addEventListener("click", function (e) {
    var link = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (link) levar(link);
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", levarTodos);
  else levarTodos();
})();
