import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(dir, "../.env.local"), "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const LIVE = process.argv.includes("--live");
const ADMIN_EMAIL = "luan.antunes@jards.com.br";
const USERS_CSV = "/Users/luanantunesdebarros/Downloads/Banco de Dados/User.csv";
const SUBS_CSV = "/Users/luanantunesdebarros/Downloads/Banco de Dados/Subs.csv";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const PRICE_PLAN = {
  [env.STRIPE_PRICE_BASICO]: "basico",
  [env.STRIPE_PRICE_PROFISSIONAL]: "profissional",
};

function readCsv(path) {
  return parse(readFileSync(path, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
}

const userRows = readCsv(USERS_CSV);
const subRows = readCsv(SUBS_CSV);

const subsByEmail = new Map(
  subRows
    .filter(s => s.Owner?.trim())
    .map(s => [s.Owner.trim().toLowerCase(), s])
);

const seen = new Set();
const targets = [];
for (const row of userRows) {
  const email = row.email?.trim().toLowerCase();
  if (!email || seen.has(email)) continue;
  seen.add(email);
  const fullName = [row.Nome, row["Segundo Nome"]].map(s => s?.trim()).filter(Boolean).join(" ") || null;
  targets.push({ email, fullName });
}

console.log(`${LIVE ? "LIVE RUN" : "DRY RUN"} — ${targets.length} usuários únicos a processar (${subsByEmail.size} com assinatura Stripe)\n`);

let created = 0, alreadyExisted = 0, failed = 0, billed = 0, adminSet = 0;

for (const { email, fullName } of targets) {
  const sub = subsByEmail.get(email);
  const tag = sub ? `[PAGANTE ${PRICE_PLAN[sub["Product ID"]] ?? "?"}]` : "[gratuito]";
  const adminTag = email === ADMIN_EMAIL ? " [SUPERADMIN]" : "";
  console.log(`- ${email} (${fullName ?? "sem nome"}) ${tag}${adminTag}`);

  if (!LIVE) continue;

  const password = randomUUID() + randomUUID();
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: fullName ? { full_name: fullName } : {},
  });

  let userId = createData?.user?.id;

  if (createErr) {
    if (createErr.message?.toLowerCase().includes("already been registered") || createErr.code === "email_exists") {
      alreadyExisted++;
      const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1, email });
      userId = existing?.users?.[0]?.id;
      if (!userId) {
        console.warn(`  já existia mas não encontrei o id, pulando billing/admin para ${email}`);
        continue;
      }
    } else {
      console.error(`  FALHOU: ${createErr.message}`);
      failed++;
      continue;
    }
  } else {
    created++;
  }

  if (sub) {
    const customerId = sub["Customer ID"];
    const priceId = sub["Product ID"];
    const plan = PRICE_PLAN[priceId] ?? "basico";
    let status = "active", periodStart = null, periodEnd = null, subscriptionId = null;
    try {
      const list = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
      const live = list.data[0];
      if (live) {
        status = live.status;
        periodStart = new Date(live.current_period_start * 1000).toISOString();
        periodEnd = new Date(live.current_period_end * 1000).toISOString();
        subscriptionId = live.id;
      }
    } catch (e) {
      console.warn(`  Stripe lookup falhou pra ${customerId}: ${e.message}`);
    }

    const { error: rpcErr } = await supabase.rpc("fn_process_stripe_billing_event", {
      p_event_id: `bubble_migration_${customerId}`,
      p_event_type: "migration.import",
      p_user_id: userId,
      p_customer_id: customerId,
      p_subscription_id: subscriptionId,
      p_invoice_id: null,
      p_price_id: priceId,
      p_plan: plan,
      p_subscription_status: status,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_paid: true,
    });
    if (rpcErr) console.error(`  billing RPC falhou pra ${email}: ${rpcErr.message}`);
    else billed++;
  }

  if (email === ADMIN_EMAIL) {
    const { error: adminErr } = await supabase.from("profiles").update({ jards_super_admin: true }).eq("id", userId);
    if (adminErr) console.error(`  falha ao marcar super admin: ${adminErr.message}`);
    else adminSet++;
  }
}

console.log(`\nResumo: ${created} criados, ${alreadyExisted} já existiam, ${failed} falharam, ${billed} com billing aplicado, ${adminSet} marcados super admin.`);
if (!LIVE) console.log("(dry run — nada foi escrito. rode com --live pra executar de verdade)");
