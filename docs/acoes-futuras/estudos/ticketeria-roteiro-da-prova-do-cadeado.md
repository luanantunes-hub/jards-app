# Roteiro: provar o cadeado do repasse com uma subconta de verdade (sandbox do Asaas)

Guardado em 19/11/2026 para retomar quando o limite de criação de subcontas do sandbox renovar. O que já foi provado com a **conta principal** no papel do produtor está na linha T5 (parte 11) do plano. Este roteiro troca a conta principal por uma **subconta** e acrescenta o teste do **webhook da subconta**.

## Cuidado com o limite (regra deste roteiro)

- O sandbox deixa criar **no máximo 20 subcontas por dia**. Em 19/11 já havia **21** (conferido em `GET /v3/accounts` com a chave da conta principal), e todas as tentativas novas voltavam 400 `invalid_object`: "Você excedeu o limite de criação de contas filhas por dia".
- O script cria **no máximo uma** subconta e a **reaproveita**: se a loja de teste já tem subconta registrada, ele lê a chave dela do Vault e **não cria outra**. Se um passo falhar depois da criação, **rode de novo sem criar nada** (não apague a loja de teste no meio).
- Antes de rodar, conferir quantas subcontas existem hoje e **não tentar de novo se a criação for recusada**.
- Nada de rodar este roteiro em laços ou "só para ver".

## Antes de começar

1. A chave do sandbox no arquivo `~/.jards-asaas-sandbox.env` (`ASAAS_API_KEY`, entre aspas simples) e um clone do `jards-app` na `main`, com `npm install`. A chave **não** vai para o chat nem para o repositório.
2. O deploy de produção com a rota `/api/ticketeria/validacao-saque/asaas` e a variável `ASAAS_VALIDACAO_SAQUE_TOKEN` na Vercel (feito em 19/11), e a validação de saque **ligada** no painel do sandbox (feito em 19/11, token igual ao da Vercel).
3. O Split habilitado no painel do sandbox (feito em 19/11) e a autoaprovação de subcontas ligada (feito em 19/11).

## Passos

1. **Preparar o banco** com o SQL de "Preparação" abaixo (organização de teste com duas vendas de R$ 35,00: uma de sessão que já passou, liberada, e outra de sessão futura, retida). Rodar com `supabase db query --linked -f arquivo.sql`.
2. **Rodar o script** (abaixo), a partir da raiz do clone, com a chave carregada só para o comando:
   `set -a; . ~/.jards-asaas-sandbox.env; set +a; npx tsx prova.ts` (o script vai dentro do clone, por exemplo como `.tmp-prova.ts`, e fica fora do git; ele importa os adaptadores de `lib/ticketeria/pagamento/`).
3. **Ler o resultado.** Esperado: saldo liberável de R$ 33,13 (só a venda liberada); **A** R$ 20,00 aprovado; **B** R$ 20,00 recusado (retido); **C** R$ 5,00 para outra conta recusado (destino não cadastrado); **D** R$ 13,00 aprovado pelo Jards (depois o banco de mentira do sandbox rejeita: não é do cadeado).
4. **Conferir o webhook da subconta** nos logs da Vercel (`vercel logs https://jards.com.br --since 15m --no-follow --json`): se o aviso do pagamento da subconta chegou em `/api/ticketeria/avisos/asaas` (webhook da conta principal) ou em `/api/ticketeria/avisos/asaas-sub` (webhook da subconta, que devolve 404 de propósito). Anotar a resposta no plano.
5. **Limpar o banco** com o SQL de "Limpeza". Conferir que as quatro contagens voltam a zero (os registros de saque ficam: são imutáveis).
6. **Registrar no plano** o que foi provado (uma linha nova na tabela de Andamento) e, se o webhook da subconta for mesmo o que recebe, **acrescentar a criação desse webhook ao cadastro da subconta** (`POST /v3/webhooks` com a chave da subconta, `authToken` igual ao de `ASAAS_WEBHOOK_TOKEN`, evento de pagamento recebido e de estorno).
7. **Revogar a chave do sandbox** (Integrações, Chaves de API) e gerar outra pelo terminal, como combinado.

## Preparação (SQL)

```sql
-- ORGANIZAÇÃO DE TESTE do cadeado. Apagar depois (ver "Limpeza").
begin;
create or replace function pg_temp.id(s text) returns uuid language sql immutable as $$ select ('0d7f0000-0000-4000-8000-' || lpad(s, 12, '0'))::uuid $$;
insert into public.organizations (id, nome) values (pg_temp.id('a0'), 'TESTE CADEADO (apagar)');
insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (pg_temp.id('a0'), 'ticketeria', 'cortesia', 5);
insert into public.ticketeria_lojas (id, organization_id, nome) values (pg_temp.id('61'), pg_temp.id('a0'), 'Loja de teste do cadeado');
insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (pg_temp.id('51'), pg_temp.id('a0'), pg_temp.id('61'), 'Teatro de teste');
insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (pg_temp.id('41'), pg_temp.id('a0'), pg_temp.id('51'), 'Plateia', 50);
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (pg_temp.id('71'), pg_temp.id('a0'), pg_temp.id('61'), 'Evento de teste do cadeado', 'publicado');
insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
  (pg_temp.id('81'), pg_temp.id('a0'), pg_temp.id('71'), pg_temp.id('51'), now() + interval '10 days'),
  (pg_temp.id('82'), pg_temp.id('a0'), pg_temp.id('71'), pg_temp.id('51'), now() + interval '20 days');
insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (pg_temp.id('31'), pg_temp.id('a0'), pg_temp.id('71'), pg_temp.id('41'), 'Inteira', 'inteira');
insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (pg_temp.id('21'), pg_temp.id('a0'), pg_temp.id('31'), '1º lote', 0, 3500, 10);
create temp table ped (nome text, id uuid);
insert into ped select 'a', (public.fn_ticketeria_reservar(pg_temp.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', pg_temp.id('31'), 'quantidade', 1)), 'Teste', 'teste@teste.invalid', 15) ->> 'pedido_id')::uuid;
insert into ped select 'b', (public.fn_ticketeria_reservar(pg_temp.id('82'), jsonb_build_array(jsonb_build_object('ingresso_id', pg_temp.id('31'), 'quantidade', 1)), 'Teste', 'teste@teste.invalid', 15) ->> 'pedido_id')::uuid;
select public.fn_ticketeria_definir_meio(id, 'pix', null) from ped;
select public.fn_ticketeria_confirmar_pagamento_real(id, 'asaas', 'ref-teste-' || nome, 3500, 3401) from ped;
-- A: a sessão já passou e a venda é de 10 dias atrás: liberada. B: a sessão é daqui a 20 dias: retida.
update public.ticketeria_pedidos set pago_em = now() - interval '10 days' where id in (select id from ped where nome = 'a');
update public.ticketeria_sessoes set inicio = now() - interval '3 days' where id = pg_temp.id('81');
commit;
select count(*) as pedidos_pagos from public.ticketeria_pedidos where organization_id = '0d7f0000-0000-4000-8000-0000000000a0' and situacao = 'pago';
```

## Limpeza (SQL)

```sql
begin;
delete from vault.secrets where name = 'ticketeria_asaas_0d7f0000-0000-4000-8000-000000000061';
delete from public.organizations where id = '0d7f0000-0000-4000-8000-0000000000a0';
commit;
select (select count(*) from public.organizations where id = '0d7f0000-0000-4000-8000-0000000000a0') as organizacao_de_teste,
       (select count(*) from public.ticketeria_pedidos where loja_id = '0d7f0000-0000-4000-8000-000000000061') as pedidos_de_teste,
       (select count(*) from public.ticketeria_contas_asaas where loja_id = '0d7f0000-0000-4000-8000-000000000061') as contas_de_teste,
       (select count(*) from vault.secrets where name like 'ticketeria_asaas_0d7f%') as segredos_de_teste;
```

## Script

```ts
import { execFileSync } from "node:child_process";
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { ProvedorAsaas, URL_DO_SANDBOX } from "./lib/ticketeria/pagamento/asaas";
import { SubcontasAsaas } from "./lib/ticketeria/pagamento/asaas-subconta";

// PROVA DO CADEADO COM UMA SUBCONTA DE VERDADE (sandbox do Asaas). Cria NO MÁXIMO UMA subconta e a reaproveita nas rodadas seguintes.
const chave = process.env.ASAAS_API_KEY ?? "";
if (!chave.startsWith("$aact_hmlg_")) throw new Error("a chave não é de sandbox");
const LOJA = "0d7f0000-0000-4000-8000-000000000061";
const TMP = "../.tmp-prova-registrar.sql";
const URL_PRINCIPAL = "https://jards.com.br/api/ticketeria/avisos/asaas";
const URL_SUBCONTA = "https://jards.com.br/api/ticketeria/avisos/asaas-sub"; // não existe: o 404 nos logs da Vercel mostra que o aviso chegou aqui

function cnpjValido() {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (n: number[]) => { const pesos = n.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = n.reduce((a, v, i) => a + v * pesos[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  base.push(dv(base)); base.push(dv(base)); return base.join("");
}
function cpfValido() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (n: number[]) => { const s = n.reduce((a, v, i) => a + v * (n.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dv(d)); d.push(dv(d)); return d.join("");
}
async function bruto(k: string, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${URL_DO_SANDBOX}${caminho}`, { method: metodo, headers: { access_token: k, "content-type": "application/json", "user-agent": "Jards-Ticketeria-teste/1.0" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
  return { status: r.status, corpo: j ?? t.slice(0, 200) };
}
const sql = (c: string) => { writeFileSync(TMP, c); chmodSync(TMP, 0o600); try { return execFileSync("supabase", ["db", "query", "--linked", "-f", TMP], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } finally { rmSync(TMP, { force: true }); } };
const consulta = (c: string) => execFileSync("supabase", ["db", "query", "--linked", c], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const campo = (saida: string, nome: string) => new RegExp(`"${nome}"\\s*:\\s*"?([^",}\\s]+)"?`).exec(saida)?.[1];

async function main() {
  // 1) A subconta: reaproveita a que já está registrada na loja de teste; só cria se não houver.
  const ja = campo(consulta(`select count(*) as n from public.ticketeria_contas_asaas where loja_id = '${LOJA}';`), "n");
  let chaveSub = "";
  let cnpj = "";
  let walletSub = "";
  if (ja === "0") {
    const asaas = new SubcontasAsaas({ chaveDaConta: chave });
    cnpj = cnpjValido();
    const sub = await asaas.criarSubconta({ nome: "Produtor Teste Cadeado", email: `cadeado.${Date.now()}@example.com`, cpf_cnpj: cnpj, tipo_empresa: "LIMITED", celular: "(11) 98765-4321", cep: "01310-100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", renda_mensal_centavos: 500000 });
    chaveSub = sub.chave; walletSub = sub.wallet_id;
    await asaas.criarChavePix(chaveSub);
    sql(`select public.fn_ticketeria_registrar_conta_asaas('${LOJA}', '${sub.asaas_account_id}', '${sub.wallet_id}', '${cnpj}', '${chaveSub}', 'aprovada'); select public.fn_ticketeria_definir_conta_destino('${LOJA}', '001', '0001', '123456', '7');`);
    console.log("subconta CRIADA (a única desta prova) e registrada no Jards; chave no Vault");
  } else {
    chaveSub = campo(consulta(`select public.fn_ticketeria_chave_da_conta_asaas('${LOJA}') as k;`), "k") ?? "";
    cnpj = campo(consulta(`select cpf_cnpj as c from public.ticketeria_contas_asaas where loja_id = '${LOJA}';`), "c") ?? "";
    walletSub = campo(consulta(`select wallet_id as w from public.ticketeria_contas_asaas where loja_id = '${LOJA}';`), "w") ?? "";
    console.log("subconta REAPROVEITADA (nenhuma criada nesta rodada)");
  }
  if (!chaveSub) throw new Error("sem a chave da subconta");
  console.log("saldo liberável no banco (centavos):", campo(consulta(`select public.fn_ticketeria_saldo_liberavel('${cnpj}') as s;`), "s"));

  // 2) Os webhooks: um na conta principal e um na subconta, em endereços diferentes, para ver ONDE chega o aviso do pagamento da subconta.
  const carteira = (await bruto(chave, "GET", "/wallets/")).corpo?.data?.[0]?.id as string;
  const evento = ["PAYMENT_RECEIVED"];
  const wp = await bruto(chave, "POST", "/webhooks", { name: "teste-principal", url: URL_PRINCIPAL, email: "luan.antunes@jards.com.br", enabled: true, interrupted: false, sendType: "NON_SEQUENTIALLY", events: evento, authToken: "t".repeat(40) });
  const ws = await bruto(chaveSub, "POST", "/webhooks", { name: "teste-subconta", url: URL_SUBCONTA, email: "luan.antunes@jards.com.br", enabled: true, interrupted: false, sendType: "NON_SEQUENTIALLY", events: evento, authToken: "s".repeat(40) });
  console.log("webhook da principal:", wp.status, wp.corpo?.errors ?? "ok", "| webhook da subconta (chave da subconta):", ws.status, ws.corpo?.errors ?? "ok");

  // 3) Saldo de verdade na subconta: Pix de R$ 50 com divisão para o Jards, confirmado pelo sandbox.
  const comoSub = new ProvedorAsaas({ chave: chaveSub, tokenDoWebhook: "x".repeat(40) });
  const c = await comoSub.criarCobranca({ id: crypto.randomUUID(), codigo: "PROVA001", total_centavos: 5000, expira_em: new Date(Date.now() + 86400000).toISOString(), comprador_nome: "Teste", comprador_email: "t@t.invalid", comprador_documento: cpfValido(), split: [{ carteira, valor_centavos: 125 }] });
  await bruto(chaveSub, "POST", `/sandbox/payment/${c.ref}/confirm`);
  console.log("pagamento confirmado em", new Date().toISOString(), "| saldo da subconta (R$):", (await bruto(chaveSub, "GET", "/finance/balance")).corpo?.balance, "| cobrança:", c.ref);
  await new Promise(r => setTimeout(r, 20000));

  // 4) Os saques pela chave da SUBCONTA.
  const banco = { bank: { code: "001" }, accountName: "Conta Teste", ownerName: "Produtor Teste", cpfCnpj: cpfValido(), agency: "0001", account: "123456", accountDigit: "7", bankAccountType: "CONTA_CORRENTE" };
  const sacar = async (rotulo: string, valor: number, destino = banco) => {
    const t = await bruto(chaveSub, "POST", "/transfers", { value: valor, bankAccount: destino });
    if (!t.corpo?.id) { console.log(`${rotulo}: pedido recusado pelo Asaas`, JSON.stringify(t.corpo?.errors ?? t.corpo)); return; }
    let s = "";
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const g = (await bruto(chaveSub, "GET", `/transfers/${t.corpo.id}`)).corpo;
      s = `${g?.status}${g?.failReason ? " (" + g.failReason + ")" : ""}`;
      if (["FAILED", "CANCELLED", "DONE", "BANK_PROCESSING"].includes(g?.status)) break;
    }
    console.log(`${rotulo}: R$ ${valor.toFixed(2)} → ${s}`);
  };
  await sacar("A) saque dentro do liberável", 20);
  await sacar("B) saque que passa do liberável", 20);
  await sacar("C) saque para OUTRA conta (654321)", 5, { ...banco, account: "654321" });
  await sacar("D) o que sobra do liberável", 13);
  console.log("--- decisões gravadas ---");
  console.log(consulta(`select decisao, motivo, valor_centavos from public.ticketeria_validacoes_saque where cpf_cnpj = '${cnpj}' order by created_at;`).split("\n").filter(l => /"(decisao|motivo|valor_centavos)"/.test(l)).map(l => l.trim()).join(" "));

  // 5) Tira os webhooks de teste.
  if (wp.corpo?.id) await bruto(chave, "DELETE", `/webhooks/${wp.corpo.id}`);
  if (ws.corpo?.id) await bruto(chaveSub, "DELETE", `/webhooks/${ws.corpo.id}`);
  console.log("webhooks de teste apagados. Agora: conferir os logs da Vercel (qual caminho recebeu POST) e rodar a limpeza do banco.");
}
main().catch(e => { rmSync(TMP, { force: true }); console.error("falhou:", (e as Error).message.slice(0, 300)); process.exit(1); });
```

## O que o webhook da subconta precisa (da documentação, a confirmar no teste)

- Cada conta tem o **próprio** webhook; o da subconta se cria na criação (`webhooks` no `POST /v3/accounts`) ou com `POST /v3/webhooks` e a chave da subconta (inferência). Até 10 webhooks por conta.
- O aviso **não traz o id da subconta**; o pedido é reconhecido pelo `externalReference` (o id do pedido que já mandamos na cobrança).
- Só **HTTP 200** conta como entrega; **15 falhas seguidas** pausam a fila daquele webhook (reativar em Integrações, Webhooks). O `authToken` vai no cabeçalho `asaas-access-token`.


## Resultado da prova de 20/11/2026

O Asaas liberou a criação de subcontas (21 → 24, três delas órfãs: as duas primeiras tentativas perderam a chave por causa do limite de 20 s da criação, que leva uns 40 s, e a terceira não registrou por causa da chave Pix; o script foi ajustado e a quarta tentativa seguiu até o fim).

- **O cadeado passou com a subconta:** A R$ 20,00 aprovado; B R$ 20,00 recusado (retido); C R$ 5,00 para outra conta recusado (`destino_nao_e_de_produtor_cadastrado`); D R$ 13,00 aprovado.
- **A comissão estava sendo bloqueada:** o Asaas mandou um `PAYMENT_SPLIT` de R$ 1,25 (carteira do Jards) à validação, o cadeado respondeu `operacao_nao_permitida` e o Asaas cancelou a divisão (`EXTERNAL_AUTHORIZATION_REFUSED`). Corrigido: a divisão para a carteira do Jards é aprovada.
- **Webhook:** só o endereço da SUBCONTA recebeu o aviso do pagamento (3 POSTs em `/api/ticketeria/avisos/asaas-sub`, nenhum em `/avisos/asaas`). O cadastro da subconta agora cria o webhook nela.
- **Chave Pix da subconta:** criada, mas ficou `AWAITING_ACTIVATION` por mais de 5 minutos (sem QR de Pix nesse período). O saldo de teste veio de um boleto confirmado pelo sandbox (`POST /v3/sandbox/payment/{id}/confirm`).
- **Token de webhook:** o Asaas recusa mais de 4 caracteres iguais seguidos (o script usava 40 letras iguais).
- Banco de teste limpo (as quatro contagens em zero).
