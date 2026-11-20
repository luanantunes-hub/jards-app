# Teste de custo de Reuniões (fase 1 do plano)

Objetivo: descobrir, com uma reunião de verdade, **quanto a Groq vai faturar por hora de reunião** quando o Vexa transcreve, e checar qualidade em português e identificação de quem fala. Plano completo: `docs/acoes-futuras/estudos/plano-reunioes-transcricao.md`.

Nada aqui mexe no Jards em produção. O teste usa um Vexa separado e uma chave da Groq só para ele.

## O que precisa existir

1. **Uma máquina com Docker** (versão 26 ou mais nova). Pode ser o Mac com Docker Desktop, ou um servidor pequeno alugado (qualquer VPS com 4 GB de memória serve para o teste). *Hoje a máquina do Claude não tem Docker, então o Vexa precisa subir na sua.*
2. **Uma chave da Groq** (`console.groq.com`, conta própria). Ela fica **só** no ambiente de quem roda o proxy; não vai para o repositório nem para o chat.
3. **Duas reuniões de teste** de uns 30 minutos (uma de Meet, outra de Teams), com 3 pessoas falando em português, e o link de cada uma.

## Passo a passo

**A. Subir o proxy de medição** (anota cada pedido que o Vexa faz à Groq):

```bash
GROQ_API_KEY=... npx tsx scripts/reunioes-spike/proxy-groq.ts
```

Ele escuta na porta 8090 e escreve `medicoes.jsonl`. Para conferir: `curl http://localhost:8090/health` deve responder `ok`.

**B. Subir o Vexa Lite** (repositório `Vexa-ai/vexa`, versão 0.12), conforme o `deploy/lite/README.md` dele:

```bash
git clone https://github.com/Vexa-ai/vexa.git && cd vexa
# no .env da raiz:
#   TRANSCRIPTION_SERVICE_URL=http://<endereço do proxy>:8090
#   TRANSCRIPTION_MODEL=whisper-large-v3-turbo
#   DEFAULT_TRANSCRIPTION_LANGUAGE=pt
make lite
```

Se o Vexa e o proxy rodam na mesma máquina, em contêineres, use o endereço da máquina na rede (não `localhost`).

**C. Mandar o bot para a reunião de teste** (o formato é o documentado no README do Vexa; confira na instância):

```bash
curl -X POST "$API_BASE/bots" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"platform":"google_meet","native_meeting_id":"abc-defg-hij","bot_name":"Jards (teste)","language":"pt","recording_enabled":true}'
```

Admita o bot na sala quando ele pedir. Converse uns 30 minutos, com a fala de cada pessoa bem separada em alguns trechos e com algum cruzamento de falas em outros.

**D. Depois da reunião:**

```bash
npx tsx scripts/reunioes-spike/proxy-groq.ts --resumo medicoes.jsonl --reuniao-min 30
```

Ele mostra os segundos faturados, **quantas vezes o mesmo áudio foi cobrado** e o custo por hora e por 100 horas de reunião.

**E. Buscar a transcrição** (`GET /transcripts/{platform}/{id}`) e anotar o que está no quadro abaixo.

## O que anotar (por reunião)

| Item | Resultado |
|---|---|
| Segundos faturados ÷ duração da reunião (o "multiplicador") | |
| Custo por hora de reunião e por 100 horas (do resumo) | |
| Processador e memória usados por bot (`docker stats` durante a reunião) | |
| Quantas falas ficaram **sem nome do falante** (de cada 100) | |
| Erros de português: nomes de empresas, leis (Rouanet, Lei do Esporte), valores | |
| O anfitrião precisou admitir o bot? Quanto tempo esperou? | |
| O bot saiu sozinho quando a reunião acabou? | |
| Formato real do webhook e da resposta de `/transcripts` (colar um exemplo) | |
| Qualquer erro ou reinício do bot | |

## Como decidir

- **Multiplicador perto de 1x e custo até US$ 0,10 por hora de reunião:** seguir para a fase 2 com a Groq.
- **Multiplicador acima de 2x:** o Vexa está mandando o mesmo áudio mais de uma vez. Ver se há uma opção de pedaços maiores no Vexa; se não houver, avaliar transcrever depois da reunião a partir da gravação.
- **Muitas falas sem nome ou muitos erros em português:** voltar ao plano antes de construir mais.

## Cuidados

- A chave da Groq nunca vai para arquivo do repositório. Revogue-a depois do teste.
- Avise quem participa de que a reunião de teste está sendo gravada.
- O proxy repassa o áudio à Groq (servidores nos EUA). Use só reuniões de teste, sem dado de cliente.
