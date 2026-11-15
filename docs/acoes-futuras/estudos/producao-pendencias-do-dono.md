# Módulo de produção: o que depende do dono

Atualizado em 15/11/2026. Tudo o que o plano permite fazer sem decisão do dono já está na main (Fases 0 a 8 em primeiros cortes, mais a PD9.1, a PD9.6, o borderô e o acerto de contas). Em 14 e 15/11 as telas do dinheiro e da sessão foram arrumadas com o dono: linha clicável e página própria (acordo, pedido, fatura, adiantamento, linha do orçamento), menu da produção em seções que abrem e fecham, telas da sessão em abas e protótipos removidos. O que sobra está aqui, com a recomendação de cada item para responder rápido. Quem decide é o Luan; nada abaixo foi aplicado.

## 1. Dinheiro: borderô (PD7.4) e acerto de contas (PD7.9) — decidido e na main

O Luan respondeu em 13/11/2026 e os dois primeiros cortes estão na main: o borderô da sessão (#203) e o acerto de contas do borderô (#204). Valeram as recomendações: deduções em **lista aberta por sessão**, sem alíquota pronta (quem confere é o contador); a **mesma permissão de dinheiro** (quem não a tem vê só o público); público **da casa e da porta juntos**, com aviso quando divergem; acerto **calculado do borderô**, sem pagar nada pelo app. O detalhe de cada um está na tabela "Andamento" do plano.

Sobra desta frente, e só depois de mais decisões: **pagar pelo app** (junto do item 2), modelos de acerto por contrato, PDF do acerto assinado, o acerto da temporada inteira, e o custo por praça e por espectador no relatório da temporada.

## 2. Pagamento online (decisões 16 a 19)

Só trava a venda de ingresso online (PD12.6, PD12.8, PD12.9). Não trava nada do que já foi feito. As perguntas estão em `~/Downloads/perguntas-provedores-pagamento.md`. Recomendação: **não começar a PD12.4 em diante** antes de escolher o provedor, porque o repasse (split) muda o desenho.

## 3. Texto de privacidade

Destrava: os portais do patrocinador (PD9.2) e do artista (PD9.4), a matrícula por link na formação e o uso aberto dos links públicos que já estão no ar.

O que o app coleta hoje de gente de fora da organização, **todos só com concordância marcada ou só o essencial**:

| Onde | O que entra | Para quê |
|---|---|---|
| Voluntários (`/voluntario`) | nome, e-mail ou telefone, disponibilidade | organizar o voluntariado da temporada |
| Visitação (`/visita`) | nome do grupo, nome do responsável, e-mail ou telefone, quantas pessoas | agendar a visita do grupo |
| Pedidos de convidados (`/convidar`) | nome de quem pede e nome e afiliação do convidado | cota de ingressos de cortesia |
| Formação (cadastro pela produção) | nome do aluno, e-mail ou telefone opcionais | matrícula, frequência e certificado |
| Convite de presença (`/presenca`) | resposta, datas de chegada e saída, observação | logística da equipe |

Nenhum coleta CPF, documento, dado de saúde ou foto. As páginas já pedem para não escrever dado sensível.

### Rascunho para o jurídico revisar

> **Dados de quem se inscreve, agenda ou é convidado pela produção**
>
> Quando você se inscreve como voluntário, agenda uma visita, pede ou recebe um convite, responde a um convite de presença ou é matriculado em uma formação, a organização que publicou o link recebe o seu nome e, quando você informar, um e-mail ou telefone, a disponibilidade, o nome do grupo e o número de pessoas.
>
> Usamos esses dados apenas para organizar aquele evento: falar com você, confirmar a sua participação, controlar vagas e emitir o certificado, quando houver. Não pedimos documento, dado de saúde nem foto, e pedimos que você não os escreva nos campos de texto.
>
> Quem vê: as pessoas da equipe da organização que publicou o link e têm acesso à produção. Não vendemos nem compartilhamos esses dados com terceiros.
>
> Por quanto tempo: [decisão do dono: sugestão de 12 meses após a data do evento, depois apagamos ou tornamos anônimos].
>
> Seus direitos: você pode pedir para ver, corrigir ou apagar os seus dados a qualquer momento escrevendo para [e-mail do encarregado de dados da organização].

**Decisões que só o dono toma:** (1) o prazo de guarda; (2) o e-mail do encarregado; (3) se o Jards aparece como operador e a organização cliente como controladora (recomendado, porque cada organização decide o que coleta); (4) onde o texto fica (§3.3 da política em `app/privacidade/page.tsx`) e o link que as páginas públicas mostram.

**Depois do texto aprovado, o código faz:** o link para ele no rodapé das páginas públicas, a rotina que apaga ou anonimiza depois do prazo e o pedido de exclusão feito pela própria pessoa.

## 4. Escolhas de produto

- **Leitura de passagem por IA (PD6.6):** tem custo por leitura. Recomendação: começar com um limite pequeno por organização por mês e mostrar quanto foi usado, como já se faz nas outras chamadas de IA do app (`producao_ia_chamadas` da PD5.3).
- **Mapa da turnê com rotas e combustível (PD6.13):** precisa de um serviço de rotas. Recomendação: o mais barato que aceite uso de produto e devolva distância e tempo; decidir quando houver turnê real para testar.

## 5. Operacional

- **Painel logado:** a sessão do painel do navegador expirou em 12/11. Quando o Luan logar de novo, a conferência das telas é o próximo passo (roteiro abaixo). Quem loga é o Luan: a senha não passa por mim.
- **Três variáveis na Vercel** para o domínio próprio dos sites (PD12.1b).
- **Organização de teste** "Exemplo: Teatro Central": apagar quando não precisar mais (`~/Downloads/apagar-organizacao-de-teste-da-producao.sql`, rodar de dentro da pasta do projeto).

## Roteiro de conferência das telas (para quando o painel estiver logado)

Nada abaixo foi visto numa tela real: só banco, lógica, tipos e testes. Em cada item, o que olhar.

**Menu Gerenciamento:** Linha do tempo (`/producoes/linha-do-tempo`): filtros de área e período, "Ver mais"; mudanças recentes aparecem em frases legíveis.

**Menu Espaços:**
- Convidados (`/producoes/convidados`): criar tipo com cota, convidar, passar da cota (deve recusar), emitir credenciais, copiar a mensagem, "Trocar código", link de pedidos.
- Porta (`/producoes/porta`): digitar o código (pode entrar, já entrou, não pode entrar); botão da câmera (Chrome).
- Plateia: criar setor, "Pintar", soma passando do setor (deve recusar), barras coloridas.
- Expografia: colocar obra, marcar instalada, avisos de pendência.
- Acessibilidade: cobertura da sessão e escalar a pessoa.
- Visitação: horário com capacidade, "Agendar grupo", confirmar, passar da capacidade (deve recusar), público por dia.
- Formação: turma, aulas, matrícula, grade de presença, "Emitir certificado" (desativado com o motivo quando não pode).

**Página da data:** seção Contrapartidas (só com Captação e Produção), Ocorrências, Roteiro "Começou" e "Terminou", Deslocamentos com checklist e carga por veículo.

**Página da temporada:** Voluntários (criar link, aprovar), Convites, Hospedagem e mapa de quartos, Relatório da temporada (números e texto copiável).

**Páginas públicas** (abrir sem login, de preferência no celular, com um link gerado na tela): `/voluntario/…`, `/convidar/…`, `/visita/…`, `/credencial/…` (QR), `/presenca/…`, `/minha-folha`. Conferir: texto claro, botão de enviar, mensagem de erro quando o link vence.

**O que pode estar errado e eu não sei:** layout em tela estreita, textos cortados, botão fora do lugar, algum carregamento que demora. Anote o que ver; corrijo no mesmo dia.
