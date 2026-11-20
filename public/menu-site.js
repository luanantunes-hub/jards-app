// Menu do site: submenu "Produto" no computador e painel no celular.
// Abre por clique ou teclado; com mouse, também ao passar por cima.
(function () {
  var grupos = Array.prototype.slice.call(document.querySelectorAll("[data-menu-grupo]"));
  var comMouse = window.matchMedia("(hover: hover) and (pointer: fine)");
  var timers = new Map();
  var abertoPorMouseEm = 0;

  function gatilhoDe(grupo) { return grupo.querySelector("[data-menu-gatilho]"); }
  function itensDe(grupo) { return Array.prototype.slice.call(grupo.querySelectorAll(".menu-site__item")); }

  // O painel se alinha pela direita do botão (assim, mesmo fechado, não passa da borda
  // direita nem cria rolagem lateral); ao abrir, se passar de alguma borda, desliza para dentro.
  function encaixar(grupo) {
    var painel = grupo.querySelector(".menu-site__painel");
    if (!painel) return;
    painel.style.right = "";
    var margem = 12;
    var r = painel.getBoundingClientRect();
    var desloc = 0;
    if (r.right > window.innerWidth - margem) desloc = window.innerWidth - margem - r.right;
    if (r.left + desloc < margem) desloc = margem - r.left;
    if (desloc) painel.style.right = (-desloc) + "px";
  }

  function abrir(grupo) {
    grupos.forEach(function (outro) { if (outro !== grupo) fechar(outro); });
    clearTimeout(timers.get(grupo));
    encaixar(grupo);
    grupo.classList.add("is-aberto");
    gatilhoDe(grupo).setAttribute("aria-expanded", "true");
  }
  function fechar(grupo) {
    clearTimeout(timers.get(grupo));
    grupo.classList.remove("is-aberto");
    gatilhoDe(grupo).setAttribute("aria-expanded", "false");
  }

  grupos.forEach(function (grupo) {
    var gatilho = gatilhoDe(grupo);

    gatilho.addEventListener("click", function () {
      var aberto = grupo.classList.contains("is-aberto");
      // Quem acabou de abrir passando o mouse e clica não deve ver o menu fechar.
      if (aberto && Date.now() - abertoPorMouseEm > 400) fechar(grupo);
      else abrir(grupo);
    });

    grupo.addEventListener("mouseenter", function () {
      if (!comMouse.matches) return;
      if (!grupo.classList.contains("is-aberto")) abertoPorMouseEm = Date.now();
      abrir(grupo);
    });
    grupo.addEventListener("mouseleave", function () {
      if (!comMouse.matches) return;
      timers.set(grupo, setTimeout(function () { fechar(grupo); }, 140));
    });

    grupo.addEventListener("keydown", function (evento) {
      var itens = itensDe(grupo);
      var atual = itens.indexOf(document.activeElement);
      if (evento.key === "Escape" && grupo.classList.contains("is-aberto")) {
        evento.preventDefault(); fechar(grupo); gatilho.focus();
      } else if (evento.key === "ArrowDown") {
        evento.preventDefault(); abrir(grupo); itens[Math.min(atual + 1, itens.length - 1)].focus();
      } else if (evento.key === "ArrowUp" && atual >= 0) {
        evento.preventDefault(); if (atual === 0) gatilho.focus(); else itens[atual - 1].focus();
      }
    });

    grupo.addEventListener("focusout", function (evento) {
      if (!grupo.contains(evento.relatedTarget)) fechar(grupo);
    });

    grupo.addEventListener("click", function (evento) {
      if (evento.target.closest(".menu-site__item")) fechar(grupo);
    });
  });

  document.addEventListener("click", function (evento) {
    grupos.forEach(function (grupo) { if (!grupo.contains(evento.target)) fechar(grupo); });
  });
  window.addEventListener("resize", function () { grupos.forEach(fechar); });

  // Celular
  var botao = document.querySelector("[data-menu-celular]");
  var painel = document.getElementById("menuCelular");
  if (!botao || !painel) return;

  function definir(aberto) {
    painel.hidden = !aberto;
    botao.setAttribute("aria-expanded", String(aberto));
    botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    var icone = botao.querySelector("i");
    if (icone) icone.className = aberto ? "ph ph-x" : "ph ph-list";
  }

  botao.addEventListener("click", function () { definir(painel.hidden); });
  painel.addEventListener("click", function (evento) { if (evento.target.closest("a")) definir(false); });
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !painel.hidden) { definir(false); botao.focus(); }
  });
  document.addEventListener("click", function (evento) {
    if (!painel.hidden && !painel.contains(evento.target) && !botao.contains(evento.target)) definir(false);
  });
  window.matchMedia("(min-width: 768px)").addEventListener("change", function (consulta) {
    if (consulta.matches) definir(false);
  });
})();
