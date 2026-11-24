# Onças descendo de corda (landing da Ticketeria) — arquivado em 23/11/2026

Duas onças antropomórficas descem de corda até o palco da arena na abertura de `public/ticketeria.html`, ficam sobre ele e são puxadas de volta para cima. Uma vez só por visita. O Luan pediu para tirar da landing e guardar para uso futuro.

## O que há aqui

| Arquivo | O que é |
|---|---|
| `oncas-quadros.webp` | Folha de quadros: 50 quadros de 250 × 480 px, em grade de 8 colunas, WebP com transparência (532 KB). Antes ficava em `public/assets/ticketeria-oncas-quadros.webp`. |
| `trecho.html` | O `<canvas class="tku-bichos">` que ficava dentro de `.tku-hero`. |
| `trecho.css` | Posição, animação de descida (`tku-desce-bichos`, 8 s) e regra que esconde abaixo de 1024 px e com "reduzir movimento". |
| `trecho.js` | Player em canvas: desenha um quadro por vez (10 fps), remove o canvas no `animationend`. |
| `fonte/video-midjourney.mp4` | Vídeo original do Midjourney (papel creme com vinheta, em laço). |
| `scripts/recorte.py`, `scripts/monta.py` | Recorte do fundo e montagem do sprite (veja abaixo). |

## Como recolocar

1. Copiar `oncas-quadros.webp` para `public/assets/ticketeria-oncas-quadros.webp`.
2. Colar `trecho.css` no CSS da landing (antes de `.tku-hero-arte`), `trecho.html` dentro de `<section class="tku-hero">` e `trecho.js` num `<script>` antes do fim da página.
3. A posição horizontal (`left: calc(87.5% - …)`) mira o palco da arena (a ~87,5% da largura do conteúdo, 200 × 384 px, `top: 58px`). Se a arte ou a grade da abertura mudarem, ajuste `left`/`top` e os `translateY` dos keyframes (a descida vai de -442 px até 0).

## Decisões que valem a pena lembrar

- **Canvas, não WebP animado.** O WebP animado com transparência deixava um rastro (fantasma) no Safari: o encoder gera quadros de recorte parcial e metade usa "dispose to background", que o Chrome respeita e o Safari não. Folha estática + `clearRect` + `drawImage` do quadro inteiro resolve pela causa. Nunca foi testado em WebKit de verdade (só Chromium); o Luan viu o fantasma no Safari antes e a correção seguiu a causa. Detalhes em `reference-animacao-transparente-safari` (memória do projeto).
- Só entra depois de `load` + `decode()` da folha, só em telas ≥ 1024 px e sem `prefers-reduced-motion`.
- Coreografia (8 s): 1 s a corda aparece, 2 s as onças entram, 3,6 s param sobre o palco, 6,4 s a corda as puxa para cima, 8 s acabou.
- Vídeo com alfa (VP9/HEVC) não ficou menor que o WebP (885/721 KB para 5 s) e o Safari complica a escolha de `<source>`.

## Como o sprite foi feito (para refazer com outro vídeo)

1. Extrair os quadros do vídeo (`ffmpeg -i fonte/video-midjourney.mp4 k%03d.png`, 50 quadros em laço).
2. `scripts/recorte.py quadro.png saida.png` tira o papel: estima a vinheta de cada quadro (gaussiana do que não é personagem, preenchida por dentro), alfa pela distância de cor ao fundo, fecha buracos pequenos e desmistura a cor nas bordas. Rodar em todos os quadros (saída `kNNN.png` RGBA) antes do passo 3.
3. `scripts/monta.py` (rodar na pasta dos `kNNN.png` recortados) tira poeira, mede onde cada corda entra e sai, e desenha corda a mais: para cima até uma âncora fixa (balança como pêndulo, sem quina na emenda) e para baixo até um nó. Usa as constantes `H0 = 542` (as 2 últimas fileiras do vídeo têm uma linha solta) e `U`/`D` (corda a mais). Salva `sprite.npy`.
4. Reduzir cada quadro para 250 × 480, montar a grade de 8 colunas e salvar como WebP com alfa (lossy). Esse último passo não ficou em script: é um `Image.new` + `paste` de 8 × 7 células.

Dependências: Python 3, numpy, scipy, Pillow. Nenhum serviço externo.
