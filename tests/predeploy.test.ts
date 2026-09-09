import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("cada migration possui uma versão única", async () => {
  const files = (await readdir(path.join(root, "supabase/migrations")))
    .filter(file => file.endsWith(".sql"));
  const versions = files.map(file => file.split("_")[0]);
  const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test("backends Stripe usam profiles ou o processador transacional de billing", async () => {
  const files = [
    "supabase/functions/stripe-checkout/index.ts",
    "supabase/functions/stripe-webhook/index.ts",
    "app/api/stripe/portal/route.ts",
    "app/api/stripe/webhook/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.match(
      source,
      /from\(["']profiles["']\)|fn_process_stripe_billing_event/,
      `${file} deve usar profiles diretamente ou o RPC transacional de billing`,
    );
    assert.doesNotMatch(source, /from\(["']accounts["']\)/, `${file} não pode usar accounts`);
  }
});

test("billing Stripe renova créditos com idempotência e suspende inadimplentes", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260830063000_stripe_billing_lifecycle.sql"),
    "utf8",
  );
  const webhookRoute = await readFile(path.join(root, "app/api/stripe/webhook/route.ts"), "utf8");
  const webhookFunction = await readFile(path.join(root, "supabase/functions/stripe-webhook/index.ts"), "utf8");

  assert.match(migration, /stripe_event_id text NOT NULL UNIQUE/i);
  assert.match(migration, /renewal_key text UNIQUE/i);
  assert.match(migration, /creditos_usados = CASE WHEN p_paid OR NOT v_active THEN 0/i);
  assert.match(migration, /stripe_subscription_status IN \('active', 'trialing'\)/i);
  for (const source of [webhookRoute, webhookFunction]) {
    assert.match(source, /invoice\.paid/);
    assert.match(source, /invoice\.payment_failed/);
    assert.match(source, /customer\.subscription\.updated/);
    assert.match(source, /customer\.subscription\.deleted/);
  }
});

test("contrato de planos e configuração de assentos está documentado", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260830044912_predeploy_phase1_fixes.sql"),
    "utf8",
  );
  const envExample = await readFile(path.join(root, ".env.example"), "utf8");
  assert.match(migration, /rename value 'starter' to 'basico'/);
  assert.match(migration, /rename value 'pro' to 'profissional'/);
  assert.match(envExample, /^STRIPE_PRICE_SEAT=/m);
});

test("assentos são comprados em lote e convites apenas consomem capacidade", async () => {
  const purchaseRoute = await readFile(path.join(root, "app/api/members/seats/route.ts"), "utf8");
  const memberRoute = await readFile(path.join(root, "app/api/members/add/route.ts"), "utf8");
  const inviteRoute = await readFile(path.join(root, "app/api/members/invite/route.ts"), "utf8");
  const memberModal = await readFile(path.join(root, "components/modals/NovoMembroModal.tsx"), "utf8");
  const welcomeModal = await readFile(path.join(root, "components/modals/BoasVindasEquipeModal.tsx"), "utf8");
  const migration = await readFile(path.join(root, "supabase/migrations/20260830051530_organization_seats_and_invitations.sql"), "utf8");
  const captadorMigration = await readFile(path.join(root, "supabase/migrations/20260830073000_captadores_nao_consumem_assentos.sql"), "utf8");
  const roleMigration = await readFile(path.join(root, "supabase/migrations/20260830080000_team_access_roles.sql"), "utf8");
  assert.match(purchaseRoute, /resultingQuantity = summary\.purchased \+ quantity/);
  assert.match(purchaseRoute, /quantity: resultingQuantity/);
  assert.match(purchaseRoute, /payment_behavior: "error_if_incomplete"/);
  assert.doesNotMatch(memberRoute, /subscriptionItems/);
  assert.match(memberRoute, /Não há vagas disponíveis/);
  assert.match(memberRoute, /add_organization_member_with_seat/);
  assert.match(inviteRoute, /inviteUserByEmail/);
  assert.match(inviteRoute, /reserve_organization_invitation/);
  assert.match(memberModal, /setCelebrationQuantity\(quantity\)/);
  assert.match(memberModal, /BoasVindasEquipeModal/);
  assert.match(welcomeModal, /Convidar membros/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.doesNotMatch(migration, /create\s+trigger\s+trg_enforce_organization_seat_capacity/i);
  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\.handle_new_user/i);
  assert.match(captadorMigration, /target_role <> 'captador'/);
  assert.match(captadorMigration, /papel <> 'captador'/);
  assert.match(captadorMigration, /role <> 'captador'/);
  assert.match(roleMigration, /papel IN \('admin', 'colaborador', 'leitor', 'captador'\)/);
  assert.match(roleMigration, /AS RESTRICTIVE FOR UPDATE/);
  assert.match(roleMigration, /auth_can_write_org/);
});

test("configurações administrativas usam APIs protegidas e Stripe multi-item é seguro", async () => {
  const settingsPage = await readFile(path.join(root, "app/(dashboard)/configuracoes/page.tsx"), "utf8");
  const settingsRoute = await readFile(path.join(root, "app/api/settings/organization/route.ts"), "utf8");
  const memberRoute = await readFile(path.join(root, "app/api/members/[userId]/route.ts"), "utf8");
  const webhookRoute = await readFile(path.join(root, "app/api/stripe/webhook/route.ts"), "utf8");
  const webhookFunction = await readFile(path.join(root, "supabase/functions/stripe-webhook/index.ts"), "utf8");

  assert.doesNotMatch(settingsPage, /VALOR_USUARIO_EXTRA/);
  assert.doesNotMatch(settingsPage, /handleUpdateUsuariosExtras/);
  assert.match(settingsPage, /\/api\/settings\/organization/);
  assert.match(settingsPage, /\/api\/members\//);
  assert.match(settingsRoute, /membership\?\.papel !== "admin"/);
  assert.match(memberRoute, /ao menos um administrador/);
  assert.match(webhookRoute, /planFromSubscription/);
  assert.match(webhookFunction, /planFromSubscription/);
  assert.doesNotMatch(webhookRoute, /items\.data\[0\]/);
  assert.doesNotMatch(webhookFunction, /items\.data\[0\]/);
});

test("e-mails ficam no servidor e pedido entregue gera apenas notificação interna", async () => {
  const sender = await readFile(path.join(root, "lib/email/transactional.ts"), "utf8");
  const sponsorRoute = await readFile(
    path.join(root, "app/api/admin/patrocinadores/[id]/route.ts"),
    "utf8",
  );
  const pedidosRoute = await readFile(path.join(root, "app/api/admin/pedidos/route.ts"), "utf8");
  const notificationsMigration = await readFile(
    path.join(root, "supabase/migrations/20260830000001_notification_inbox_v2.sql"),
    "utf8",
  );
  const inviteRoute = await readFile(path.join(root, "app/api/members/invite/route.ts"), "utf8");
  const envExample = await readFile(path.join(root, ".env.example"), "utf8");

  assert.match(sender, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_RESEND/);
  assert.match(sender, /Idempotency-Key/);
  assert.match(sponsorRoute, /before\.tem_detalhe !== true && empresa\.tem_detalhe === true/);
  assert.doesNotMatch(sponsorRoute, /sendTransactionalEmail/);
  assert.match(pedidosRoute, /solicitacoes_pesquisa_empresa/);
  assert.match(pedidosRoute, /body\.status === "entregue" \? "concluida" : "pendente"/);
  assert.match(pedidosRoute, /update\(\{ tem_detalhe: true \}\)/);
  assert.match(notificationsMigration, /fn_notify_company_research_complete/);
  assert.match(notificationsMigration, /new\.status = 'concluida'/);
  assert.match(inviteRoute, /inviteUserByEmail/);
});

test("follow-ups usam a estrutura canônica em agenda, dashboard e notificações", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260830120000_followups_canonical.sql"),
    "utf8",
  );
  const activities = await readFile(path.join(root, "app/(dashboard)/atividades/page.tsx"), "utf8");
  const dashboard = await readFile(path.join(root, "app/(dashboard)/dashboard/page.tsx"), "utf8");
  const relationship = await readFile(path.join(root, "components/relationship/RelationshipWorkspace.tsx"), "utf8");
  const negotiationModal = await readFile(path.join(root, "components/modals/NovaCaptacaoModal.tsx"), "utf8");

  assert.match(migration, /fn_sync_captacao_proximo_followup/);
  assert.match(migration, /fn_concluir_followup_com_interacao_v2/);
  assert.match(migration, /fn_dispatch_followup_notifications/);
  assert.match(migration, /AS RESTRICTIVE[\s\S]+FOR UPDATE/i);
  assert.match(activities, /followupsToActivities/);
  assert.match(dashboard, /from\("crm_followups"\)/);
  assert.match(relationship, /Agendar próximo follow-up/);
  assert.match(relationship, /responsavel_id/);
  assert.match(negotiationModal, /from\("crm_followups"\)/);
});
