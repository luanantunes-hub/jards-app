# Módulo de produção — contexto para continuar

> Atualizado em 29/10/2026 (a versão anterior era de 15/10). Ponto de partida para quem continua o módulo de produção numa sessão local, com acesso ao Supabase. Leia isto antes do plano.

## Onde está cada coisa

| Documento | Para quê |
|---|---|
| [estudo-modulo-producao.md](./estudo-modulo-producao.md) | A ideia, o mapa de funcionalidades e as referências estudadas (o quê e por quê) |
| [plano-implementacao-modulo-producao.md](./plano-implementacao-modulo-producao.md) | As entregas (PD0.1, PD1.3…), a ordem, os aceites, os riscos, as decisões do dono e a tabela "Andamento", atualizada a cada entrega |
| [producao-pd0-4-inventario.md](./producao-pd0-4-inventario.md) | Como a captação está protegida no banco (feito na PD0.4) |
| Este arquivo | Onde estamos, o que vem agora e os cuidados que não estão óbvios no plano |

## A visão do dono, em uma frase

Um módulo de produção **robusto**, para qualquer gênero e porte (espaço cultural que recebe, show e teatro que circulam, festival, exposição, audiovisual, formação), em que **produção é operação**: programação, pessoas, acordos com terceiros, logística, o dia, o dinheiro da produção, parceiros e mapas. A prestação de contas só recebe o que a produção registra; ela não é o centro. O dono rejeitou explicitamente uma versão "pobre", centrada em prestação.

Referências de que ele gostou: SystemOne (a data como página única), Eventival (pessoas e hospitalidade), Saturation (orçamento vivo), Bizzabo (portal e retorno do patrocinador). Ele pediu também mapa de palco, inventário, checklist de transporte e cálculo de combustível por modelo de veículo.

## Onde estamos (29/10/2026)

**Fase 0, a fundação: pronta na `main` e no banco de produção.** O banco aceita o módulo `producao` (convites, vínculos, contratos, vagas); a captação está isolada de quem não a tem; equipe e permissões da produção (`producao_funcoes`, `auth_producao_*`, tela no membro); cortesia por módulo; as tabelas `producao_obras`, `producao_temporadas`, `producao_datas`, `producao_blocos`, `producao_espacos`, `producao_salas`, `producao_historico`, `producao_funcoes` e `producao_arquivos` (com as regras do bucket); tipos e cliente tipado (`lib/producao/banco.ts` e `cliente.ts`); vocabulário e porte (`vocabulario.ts`, `porte.ts`). Ficaram de fora a cobrança (PDL.1 a PDL.3) e o limite do gratuito (PD0.13), que esperam decisões do dono.

**Acesso e visibilidade.** `/producoes` é protegido no servidor por `exigirModulo("producao")` (PD0.3, #84): entra quem usa a produção em alguma organização, ou o super admin. O módulo segue **escondido dos clientes**: no seletor de módulos só o super admin o vê (#107). **Nenhuma organização tem o módulo** e nenhuma organização real o recebe antes do piloto (marco M0, escolha do dono). Em 29/10/2026 o banco tinha 1 temporada (na organização do super admin) e nenhuma data nem bloco.

**Fase 1, o núcleo, em andamento (na `main`, sem migration nova: usa as tabelas da Fase 0):**

| Entrega | O que já existe |
|---|---|
| PD1.3 | A agenda de `/producoes`: lista por mês, calendário de mês e semana, filtros por temporada e situação, "Hoje", "Nova temporada" e "Nova data" (uma ou várias seguidas). `lib/producao/agenda.ts` |
| PD1.4 | `/producoes/temporadas`, a página da temporada (datas, situação na própria linha, "Nova data", "Copiar") e "Abrir produção" na página do projeto. A cópia leva as datas como opção, sem prazo |
| PD1.6 e PD1.7 (parte) | `/producoes/datas/[id]`: situação editável e "O dia" em blocos: hora exata, aproximada, a definir ou oculta, bloco que passa da meia-noite, "Montar o dia" pelo modelo do tipo de produção, "Novo bloco", confirmar e remover. `lib/producao/dia.ts` |

A escrita dessas telas foi **provada no banco real em 29/10/2026**, numa transação desfeita (35 de 35 verificações, ver a linha "Teste de gravação" do Andamento). Falta vê-la pela tela, no navegador, numa organização com a produção.

## Decisões do dono já tomadas

- 15/10/2026: começar a fase 0 pelas entregas que não dependem do banco; **isolar no banco os dados comerciais da captação** de quem não tem o módulo; lista ampla de tipos (os 14 do catálogo); acesso limitado às temporadas e espaços em que a pessoa está vinculada, como opção por membro; fechar o dinheiro para captador e proponente externos.
- 15/10/2026, preço: **R$ 92,80 o módulo**, pago pela organização (como o da prestação; periodicidade mensal presumida, a confirmar antes da PDL.1); **vaga extra da produção = o mesmo preço do usuário adicional** (hoje R$ 19,90). A compra de vaga da produção segue indisponível (409) e o Stripe não foi tocado.
- Cortesia comum da prestação que acaba passa a avisar os administradores (aplicado).
- Os padrões das permissões ficam: leitor com "vê o dinheiro" vê; alçada vazia = não aprova; administrador vê tudo, mesmo com o recorte "vinculado".

## Em aberto (decisões do dono, seção 12 do plano)

Teste grátis da produção; os três pilotos e o que medir; fornecedores (cadastro comum ou da produção); funil de venda das datas; provedores pagos (mapa, rotas, assinatura, QR); **política de dados pessoais da equipe** (o que se coleta, base legal, quem vê, prazo de guarda; trava a PD1.9); por quanto tempo guardar o histórico e o que fazer com o autor que pede para sair; se o suporte (super admin) pode abrir a pasta `pessoas` dos arquivos; teto de tamanho por arquivo no bucket.

## Próximos passos

1. **Equipe da data** (PD1.9, pessoas e vínculos; PD1.10, escala e conflitos). A PD1.9 depende do pré-requisito 5 (política de dados pessoais). O recorte "só onde está vinculado" (PD0.7a) hoje **falha fechado** e passa a valer na PD1.9. Hoje não existe nenhuma tabela de pessoas.
2. Ver a escrita pela tela numa organização com a produção (decisão do dono sobre qual organização; a tela só remove bloco, então dados de teste de datas e temporadas só saem por SQL).
3. O resto da PD1.6 (abas Viagem e hospedagem, Arquivos, Notas, Tarefas e Histórico, painel lateral) e da PD1.7 (blocos por sala, modelos da organização, copiar o dia), a PD1.5 (pauta do espaço) e a PD1.8 (viagem e hospedagem do dia). Seguir a ordem da seção 5 do plano. **Atualizar a tabela "Andamento" a cada entrega.**
4. A PD1.1 (extrair as visões de `/atividades`) mexe numa página que cliente real usa: combinar com o dono antes.

## Como o dono gosta de trabalhar

- Conversa em português, direto, sem jargão técnico.
- **Telas**: cada mudança vai primeiro para um branch, com prints (computador e 390 px), e só vai para a `main` depois que ele aprova ("ok", "pode subir").
- **Backend** (migration, função, teste de banco): desde 15/10/2026 ele autorizou seguir sem pedir ok a cada passo, parando só nas decisões dele (preço, teste grátis, pilotos, fornecedores, provedores pagos, política de dados pessoais, funil de venda de datas), em regressão ou teste que não passa, no que muda o que cliente real vê ou paga, e em migration que o conector recuse.
- Interface sempre pelo `DESIGN.md` (grafite `#282525`, nunca tom sobre tom, cor só no gráfico, estado vazio que explica a próxima ação).
- Mudanças pequenas e revisadas: antes de subir, rodar uma revisão crítica do próprio diff.

## Comandos de verificação

```bash
npm run -s typecheck
npm test                        # node:test; testes ficam na raiz de tests/
npx eslint <arquivos alterados> # o lint do repositório tem erros antigos; olhe só as linhas mudadas
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder npx next build --webpack
```

pgTAP (`supabase/tests/*.test.sql`) roda no editor SQL ou pelo conector, numa transação desfeita (`scripts/testes-banco-em-bloco.ts`), antes de cada merge com tabela nova. O CI não roda pgTAP nem e2e.

**Teste de gravação das telas** (o que a PD1.3 a PD1.7 mandam ao banco): monte as linhas com as próprias funções de `lib/producao/` (um script `tsx` que imprime o SQL), e rode um bloco `do` com organização, módulo e pessoas de mentira (colaborador, leitor e administrador, como em `supabase/tests/producao_rls.test.sql`), entrando como cada pessoa com `set_config('request.jwt.claims', …)` e `set_config('role', 'authenticated', true)`, cada gravação num sub-bloco com `exception`, e terminando em `raise exception` para desfazer tudo. **Sem `delete`**: o conector recusa. O conector aceita blocos de uns 35 KB. Confira depois que o banco ficou como estava.

## Cuidados que não estão óbvios

- O conector do Supabase **aceita** `DROP CONSTRAINT` (conferido na PD0.1), mas **recusa** blocos de ensaio com `delete` em tabela de produção, mesmo desfeitos: não contorne; apure por catálogo e diga o que ficou sem prova.
- Função publicada não ganha parâmetro novo (sobrecarga quebra o PostgREST com PGRST203): crie função com nome novo.
- Toda função nova: `revoke execute ... from public, anon` antes do `grant`.
- "Contratos" é o contrato do patrocinador; o da produção se chama **acordo**. "Atividade" é a tarefa; o item do dia é **bloco**. "Produção" também nomeia `prestacao_producao_cmd`: nos testes, use o padrão ancorado `^producao_`.
- A produção nunca mora em tabelas `prestacao_*`: o envio da prestação trava linhas e o descarte LGPD apaga fotos. A ponte (fase 10) copia, por função que confere a trava, a guarda e o descarte, porque função `security definer` passa por cima da trava.
- Ao apagar uma organização, o banco apaga as tabelas da produção antes dos vínculos de membro, mas `projetos_crm` e `empresas_crm` são `NO ACTION` (a cascata não os apaga). As chaves entre obra, temporada e data são conferidas no fim da transação (`deferrable initially deferred`) justamente para o apagamento de uma organização inteira passar.
- Apagar uma organização não apaga os objetos do bucket `documentos`: é preciso limpar o caminho dela.
- Testes novos ficam na **raiz** de `tests/`: com um `*.test.ts` em subpasta, o `npm test` do CI deixa de rodar os da raiz sem avisar.
- O Next.js deste projeto é o 16: leia o guia em `node_modules/next/dist/docs/` antes de escrever (está no `AGENTS.md`).
