@AGENTS.md
@DESIGN.md

## Módulo de produção (em construção)

Antes de trabalhar no módulo de produção (`lib/producao/`, `/producoes`, tabelas `producao_*`), leia `docs/acoes-futuras/estudos/producao-contexto.md`: o que já foi feito, os próximos passos e os cuidados. O plano completo está em `docs/acoes-futuras/estudos/plano-implementacao-modulo-producao.md`.

## Idiomas (módulo Ingressos)

Telas da Ticketeria que já têm tradução (hoje: `/espera/{token}` e `/novidades/{token}`) leem os textos de `messages/<idioma>/ticketeria.json` em vez de tê-los no código. Texto novo nessas telas entra nos 10 idiomas, e o teste `tests/i18n-mensagens.test.ts` barra chave faltando. Antes de mexer, leia `docs/i18n/README.md` (como pôr um texto, regras do árabe, fontes) e `docs/i18n/glossario-ticketeria.md`. O resto do Jards segue só em português do Brasil.
