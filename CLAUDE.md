@AGENTS.md
@DESIGN.md

## Módulo de produção (em construção)

Antes de trabalhar no módulo de produção (`lib/producao/`, `/producoes`, tabelas `producao_*`), leia `docs/acoes-futuras/estudos/producao-contexto.md`: o que já foi feito, os próximos passos e os cuidados. O plano completo está em `docs/acoes-futuras/estudos/plano-implementacao-modulo-producao.md`.

## Publicação e prévias (Vercel)

A Vercel só constrói quando a mensagem do ÚLTIMO commit pede, para não gerar um build a cada push:

- **Prévia** (branch/PR): o commit precisa ter `[preview]` na mensagem. O link é fixo por branch, `https://jards-app-git-<branch>-jards.vercel.app`, e abre logado na Vercel.
- **Produção** (`main`): só constrói com `[publicar]` na mensagem. Mesclar um PR **não publica**: no último merge do lote, ponha `[publicar]` no título do squash, ou empurre um commit vazio com `[publicar]` para `main`.
- Um PR por assunto (por exemplo, Ticketeria ou Editais), empurrando em lotes. Cada push roda os testes do GitHub (grátis: o repositório é público).
- Entre uma prévia e outra, mostre o resultado com prints feitos localmente.
