// Registra, uma vez só, na conta do Vexa o endereço que recebe os avisos das reuniões (PUT /user/webhook): início, fim e falha do robô, assinados com o segredo combinado.
// Rode DEPOIS de a Vercel ter o mesmo VEXA_WEBHOOK_SECRET definido e a versão nova no ar. O Vexa só guarda o endereço; quem confere o funcionamento é a primeira reunião de teste.
//
//   VEXA_API_KEY=... VEXA_WEBHOOK_SECRET=... npx tsx scripts/reunioes-registrar-webhook.ts [https://jards.com.br]
//
// As chaves ficam só no ambiente de quem roda; nada é escrito em arquivo.

import { registrarWebhook } from "../lib/reunioes/vexa";

const base = (process.argv[2] ?? "https://jards.com.br").replace(/\/+$/, "");
const segredo = process.env.VEXA_WEBHOOK_SECRET;
if (!process.env.VEXA_API_KEY || !segredo) {
  console.error("Defina VEXA_API_KEY e VEXA_WEBHOOK_SECRET no ambiente.");
  process.exit(1);
}
await registrarWebhook({ url: `${base}/api/reunioes/webhook`, segredo });
console.log(`Webhook registrado: ${base}/api/reunioes/webhook (meeting.started, meeting.completed, bot.failed)`);
