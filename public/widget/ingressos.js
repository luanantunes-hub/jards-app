/*
 * Widget de ingressos da Ticketeria (Jards). Cole no site (WordPress, Wix, Webflow, Squarespace...) onde os ingressos devem aparecer:
 *
 *   <script src="https://SEU-ENDERECO/widget/ingressos.js" data-chave="tkp_..." async></script>
 *
 * Opcionais: data-evento="ID" (só um evento) e data-alvo="#id" (onde desenhar; sem isso, logo depois do script).
 * Desenha um iframe com a lista de sessões (dados públicos, só leitura); o botão Comprar abre a página de compra do Jards em outra aba.
 * O iframe avisa a altura por postMessage e este script só aceita o aviso do próprio iframe, vindo do endereço do Jards.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var chave = script.getAttribute("data-chave") || "";
  if (!/^tkp_[a-f0-9]{32}$/.test(chave)) return;
  var origem;
  try { origem = new URL(script.src).origin; } catch (e) { return; }
  var evento = script.getAttribute("data-evento") || "";
  var consulta = /^[0-9a-fA-F-]{36}$/.test(evento) ? "?evento=" + evento : "";

  var frame = document.createElement("iframe");
  frame.src = origem + "/embed/ingressos/" + chave + consulta;
  frame.title = "Ingressos";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
  frame.setAttribute("referrerpolicy", "strict-origin");
  frame.style.cssText = "width:100%;border:0;display:block;height:240px;background:transparent;color-scheme:normal";

  var seletor = script.getAttribute("data-alvo");
  var alvo = null;
  if (seletor) { try { alvo = document.querySelector(seletor); } catch (e) { alvo = null; } }
  if (alvo) alvo.appendChild(frame);
  else if (script.parentNode) script.parentNode.insertBefore(frame, script.nextSibling);

  window.addEventListener("message", function (e) {
    if (e.origin !== origem || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.tipo !== "jards-ticketeria-altura" || typeof d.altura !== "number" || !isFinite(d.altura)) return;
    frame.style.height = Math.min(Math.max(Math.round(d.altura), 120), 4000) + "px";
  });
})();
