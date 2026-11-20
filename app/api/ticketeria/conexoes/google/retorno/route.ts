// GET /api/ticketeria/conexoes/google/retorno: a volta do login do Google (este é o endereço cadastrado no cliente OAuth do Google). A conta toda está em lib/ticketeria/midia/retorno.ts.

import { type NextRequest } from "next/server";
import { concluirLogin } from "@/lib/ticketeria/midia/retorno";

export const dynamic = "force-dynamic";

// O mesmo endereço serve ao Google Ads e ao GA4 (o cookie do login diz qual dos dois abriu o login).
export const GET = (req: NextRequest) => concluirLogin(req, ["google_ads", "ga4"]);
