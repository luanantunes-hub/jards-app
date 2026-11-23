<script>
// As onças são desenhadas num canvas: cada quadro limpa o anterior e desenha o seguinte por inteiro (o WebP animado
// com transparência deixava fantasmas no Safari). Só entram depois que a folha de quadros está pronta, só no computador
// e sem "reduzir movimento". É uma vez só: quando a corda as puxa para cima, o canvas é removido.
(function () {
  var cv = document.querySelector(".tku-bichos");
  if (!cv || !window.matchMedia("(min-width:1024px) and (prefers-reduced-motion:no-preference)").matches) return;
  var ctx = cv.getContext("2d"), folha = new Image();
  var W = 250, H = 480, COLUNAS = 8, QUADROS = 50, FPS = 10;
  function comeca() {
    cv.classList.add("desce");
    var t0 = null, ultimo = -1;
    function desenha(t) {
      if (!cv.isConnected) return;
      if (t0 === null) t0 = t;
      var i = Math.floor((t - t0) / (1000 / FPS)) % QUADROS;
      if (i !== ultimo) {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(folha, (i % COLUNAS) * W, Math.floor(i / COLUNAS) * H, W, H, 0, 0, W, H);
        ultimo = i;
      }
      requestAnimationFrame(desenha);
    }
    requestAnimationFrame(desenha);
    cv.addEventListener("animationend", function () { cv.remove(); });
  }
  function carrega() {
    folha.onload = function () { (folha.decode ? folha.decode() : Promise.resolve()).then(comeca, comeca); };
    folha.src = "assets/ticketeria-oncas-quadros.webp";
  }
  if (document.readyState === "complete") carrega(); else window.addEventListener("load", carrega);
})();
</script>
