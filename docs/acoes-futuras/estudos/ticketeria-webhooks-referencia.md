# Webhooks da Ticketeria: referência para quem recebe

O Jards avisa o endereço cadastrado por um `POST` com corpo JSON quando algo acontece na loja. (Texto para a futura página de ajuda; vale como contrato do formato `versao: 1`.)

## O pedido

```
POST https://seu-endereco/...
Content-Type: application/json; charset=utf-8
User-Agent: Jards-Webhooks/1.0
X-Jards-Evento: pedido.pago
X-Jards-Entrega: 0d760000-0000-4000-8000-0000000000e1
X-Jards-Assinatura: t=1800000000,v1=<64 letras e números>
```

```json
{ "id": "0d760000-0000-4000-8000-0000000000e1", "tipo": "pedido.pago", "versao": 1, "criado_em": "2026-11-20T12:00:00Z", "tentativa": 1, "dados": { } }
```

- `id` é o **mesmo em todas as tentativas** do mesmo aviso: guarde-o e ignore o que já tratou (pode chegar mais de uma vez).
- Responda **2xx** em até 8 segundos. Qualquer outra coisa (inclusive redirecionamento, que não é seguido) conta como falha. Falhou: o Jards tenta de novo depois de 1 min, 5 min, 30 min, 2 h e 6 h; na sexta falha, desiste.
- O endereço tem de ser `https` (porta 443 ou 8443), com certificado válido e nome de site (nunca número de IP nem rede interna).

## Conferir a assinatura

`v1` é o HMAC-SHA256, em hexadecimal, de `"<t>.<corpo exato recebido>"`, com o **segredo do endereço** (`whsec_...`, mostrado uma vez ao criar ou girar). Confira também que `t` (segundos) é recente (até 5 minutos) para não aceitar um aviso capturado e reenviado.

```js
const crypto = require("crypto");
function confere(segredo, corpoCru, cabecalho) {
  const m = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(cabecalho || "");
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false;
  const esperado = crypto.createHmac("sha256", segredo).update(`${m[1]}.${corpoCru}`).digest();
  return crypto.timingSafeEqual(esperado, Buffer.from(m[2], "hex"));
}
```

## Os acontecimentos (`tipo` e `dados`)

| `tipo` | Quando | `dados` |
|---|---|---|
| `pedido.pago` | o pedido passa a pago (inclusive o gratuito) | `pedido` (id, codigo, total_centavos, desconto_centavos, cupom, meio, parcelas, pago_em), `comprador` (nome, email), `evento` (id, titulo), `sessao` (id, inicio), `itens` (ingresso_id, nome, quantidade, preco_centavos) |
| `pedido.reembolsado` | o reembolso é concluído | `pedido` (id, codigo, total_centavos, reembolsado_em), `comprador`, `evento`, `sessao` |
| `ingresso.lido` | o ingresso é lido na porta | `ingresso` (codigo, nome, assento, lido_em), `pedido` (id, codigo), `evento`, `sessao` |
| `sessao.cancelada` | a sessão é cancelada | `evento`, `sessao` (id, inicio, cancelada_em) |
| `teste` | o produtor pede um teste | `{ "mensagem": "Aviso de teste do Jards" }` |

Dinheiro em centavos. Os dados do comprador (nome e e-mail) são os mesmos que o produtor já vê em Vendas: trate-os como dados pessoais (LGPD).
