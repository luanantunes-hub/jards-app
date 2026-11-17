# Plano de implementação: Reuniões com transcrição barata

Escrito em 17/11/2026. Parte do que já existe no Jards (MVP de Reuniões com o bot Vexa, ainda sem o bot no ar) e do estudo [gravador-reunioes-read-ai.md](gravador-reunioes-read-ai.md). Meta de custo discutida: **US$ 4 por 100 horas** (US$ 0,04 por hora).

> **Todos os custos abaixo são estimativas**, tiradas de páginas públicas de preço (Groq, Fly.io, outros) e de conta de cabeça. Nenhum foi medido. A fase 1 existe para medir antes de prometer preço.

## 1. Onde estamos

**Já no código e no banco (PR #103, 29/10/2026):**
- Tabelas `reunioes`, `reuniao_transcricoes` (com busca em português), `reuniao_participantes` e mais uma, com acesso por organização.
- Páginas `/reunioes` e `/reunioes/[id]`; rotas `/api/reunioes` (criar e listar) e `/api/reunioes/webhook` (segredo no cabeçalho).
- Cliente do Vexa em `lib/reunioes/vexa.ts` e o guia `docs/reunioes-deploy-vexa.md`.

**O que falta de verdade:** o bot não está no ar (nenhuma variável `VEXA_*` definida) e o cliente foi escrito **sem ver a API real**. Lendo o README atual do Vexa, vi diferenças:
- O Vexa documenta `POST /bots` com `platform` e `native_meeting_id` (o código de dentro do link), `bot_name`, `language`, `transcribe_enabled` e `recording_enabled`. O nosso cliente manda `meeting_url` e `webhook_url`.
- A transcrição se lê em `GET /transcripts/{platform}/{native_meeting_id}`. O nosso cliente chama `/bots/{id}/transcript`.
- O guia de deploy fala em Deepgram e `TRANSCRIBER_API_KEY`; o Vexa atual usa `TRANSCRIPTION_SERVICE_URL`, `TRANSCRIPTION_SERVICE_TOKEN` e `TRANSCRIPTION_MODEL`.

Ou seja: o cliente e o guia precisam ser conferidos contra uma instância real antes de qualquer coisa (fase 1).

## 2. Como chegar perto de US$ 0,04 por hora

Três fatos que sustentam o plano (os dois primeiros eu li nos documentos do Vexa, sem testar):
1. **O Vexa Lite aceita transcrição externa compatível com a OpenAI**, e o próprio guia cita a Groq (`whisper-large-v3-turbo`) como exemplo de `TRANSCRIPTION_MODEL`. A Groq cobra **US$ 0,04 por hora de áudio** nesse modelo (página de preços dela).
2. **O Vexa Lite não pede placa de vídeo**: é um contêiner só, com Postgres e armazenamento (S3) ao lado.
3. **O custo do bot** (um Chromium por reunião) é pequeno e só existe enquanto a reunião acontece, em hospedagem cobrada por segundo (Fly.io).

**Conta provisória por hora de reunião:** transcrição US$ 0,04 + bot US$ 0,03 a 0,08 + armazenamento perto de zero + resumo (modelo pequeno, depois da reunião) US$ 0,005 a 0,02 = **US$ 0,08 a 0,14**, ou **US$ 8 a 14 por 100 horas**. Para chegar em US$ 4 total seria preciso transcrever por conta própria (placa alugada por segundo ou servidor próprio) e ter volume alto. **Isso só entra em discussão acima de milhares de horas por mês.**

**O maior ponto de dúvida:** o Vexa transcreve **em tempo real**, mandando pedaços de áudio, às vezes sobrepostos, várias vezes. A Groq cobra o mínimo de 10 segundos por pedido. Se o Vexa mandar o mesmo áudio mais de uma vez, a conta multiplica. A fase 1 mede isso na primeira reunião de teste (segundos faturados pela Groq divididos pela duração da reunião).

## 3. Fases

### Fase 1: medir antes de construir (2 a 3 dias, sem mexer no produto)
1. Subir um Vexa Lite de teste (Fly.io ou uma máquina qualquer) apontando para a Groq, com `DEFAULT_TRANSCRIPTION_LANGUAGE=pt`.
2. Duas reuniões de teste de 30 minutos (uma de Meet, uma de Teams), com 3 pessoas falando português.
3. Anotar: (a) **segundos faturados pela Groq por hora de reunião**; (b) **processador e memória por bot** (para o custo do servidor); (c) **qualidade em português** (erros de nome de empresa, de lei de incentivo, de valores); (d) **se o Vexa atribui as falas a cada pessoa** e quantas ficam sem nome; (e) o **formato real da API e do webhook**; (f) se o bot recebe a reunião de Meet sem o anfitrião admitir (admissão manual é o caso comum).
4. Resultado: uma tabela com o custo real por hora e uma decisão: seguir com a Groq, trocar de motor ou avaliar uma placa alugada.

**Pronto quando:** temos o custo por hora medido e a lista do que o cliente `vexa.ts` precisa mudar.

### Fase 2: pôr o bot no ar de verdade (3 a 5 dias)
1. Corrigir `lib/reunioes/vexa.ts` e o webhook para a API real (campos acima), com teste automático do que dá para testar sem o Vexa.
2. Deploy do Vexa Lite definitivo (Fly.io, projeto Supabase separado para o banco do Vexa, como o guia manda), segredos na Vercel (`VEXA_API_URL`, `VEXA_API_KEY`, `VEXA_WEBHOOK_SECRET`) e a chave da Groq só no Vexa.
3. Atualizar `docs/reunioes-deploy-vexa.md` com o que a fase 1 descobriu.
4. Estado da reunião no app: bot entrando, gravando, processando, concluída ou falhou, com o motivo em texto simples e o botão de tentar de novo.
5. Limite de horas por mês por organização e registro do uso (horas de bot por reunião), mesmo que ainda não se cobre.

**Pronto quando:** uma pessoa cola o link, o bot entra, e a transcrição aparece em `/reunioes/[id]` com quem falou. Teste feito com uma conta real (a do Luan na Platibanda).

### Fase 3: o que dá valor ao Jards (3 a 5 dias)
Reunião solta não vende; reunião ligada à negociação, sim.
1. **Resumo e próximos passos** depois da reunião (modelo pequeno, uma chamada), gravados em `resumo_ia`. Sem tempo real.
2. **Ligação com o CRM**: a reunião já pode apontar para negociação ou empresa; mostrar a reunião na página da negociação e criar **atividades de acompanhamento** a partir dos próximos passos, depois de a pessoa confirmar (nada é criado sozinho).
3. **Busca** nas transcrições (a coluna de texto já existe).
4. **Aviso aos participantes**: o nome do bot deixa claro que grava ("Jards, gravando a reunião") e a tela de criar a reunião lembra de avisar quem participa.
5. **Retenção e exclusão**: a pessoa pode apagar a reunião (áudio e texto); prazo padrão para apagar o áudio depois de transcrito.

### Fase 4: baixar o custo, se o volume pedir
- Só depois de a fase 1 e dois meses de uso real mostrarem o custo.
- Alavancas, em ordem: idioma fixo em português (menos detecção), cortar silêncio antes de transcrever, bot só de áudio, desligar o bot quando fica sozinho na sala, e, por último, **transcrever por conta própria** com placa alugada por segundo.
- Regra para decidir sobre transcrição própria: só se a economia por mês pagar o trabalho de manter. Pelas estimativas, a economia é de uns US$ 0,02 por hora, então só compensa com milhares de horas por mês.

### Fora do plano, de propósito
- **Análise de emoção pela voz.** Risco jurídico (LGPD e consentimento), pouca confiança do modelo (treinado em inglês) e quase nenhum valor para captação de patrocínio. Reabrir só se um cliente pedir, com advogado.
- **Transcrição ao vivo na tela.** O banco já foi desenhado só para consulta depois da reunião.
- **Zoom.** O Vexa suporta, mas a fase 2 começa com Meet e Teams, que já estão no banco.
- **Aplicativos de computador** (Meetily, Meet2Notes etc.): rodam na máquina da pessoa e não servem de base para um serviço na nuvem.

## 4. Decisões que são do Luan

| # | Decisão | Quando |
|---|---|---|
| 1 | Os dados da reunião passam pela Groq (EUA). Atualizar o texto de privacidade (§3.3) e ler os termos e a política de retenção da Groq. | Antes da fase 2 |
| 2 | Quem pode usar Reuniões e se tem teste gratuito (hoje o item aparece no menu para todos). Limite de horas por plano e preço. | Antes da fase 3 |
| 3 | Por quanto tempo guardar o áudio depois de transcrito. | Fase 3 |
| 4 | Gasto de teste da fase 1 (Groq, Fly.io, alguns dólares). | Antes da fase 1 |

## 5. Riscos

- **Meet não tem API oficial para bot.** O Vexa usa navegador automatizado, que quebra quando o Meet muda e pode ir contra os termos do Google. Mitigação: acompanhar as atualizações do Vexa e ter o aviso de "não foi possível entrar" bem claro.
- **Admissão na sala.** O anfitrião precisa admitir o bot; sem isso a reunião falha. Medir na fase 1.
- **Preço e disponibilidade da Groq** podem mudar. Mitigação: o Vexa fala com qualquer servidor compatível com a OpenAI, então trocar de fornecedor é mudar duas variáveis.
- **Português com nomes de empresas e leis** pode sair torto. Mitigação: medir na fase 1; se preciso, dar dicas de vocabulário ao modelo.
- **Projeto em evolução rápida** (Vexa 0.12): fixar a versão no deploy e testar antes de atualizar.

## 6. Ordem de trabalho

Fase 1 (medir) → decisão de custo → fase 2 (bot no ar) → fase 3 (valor no CRM) → fase 4 (só se o volume pedir). Cada fase é um PR (ou dois) com teste e nota no estudo.
