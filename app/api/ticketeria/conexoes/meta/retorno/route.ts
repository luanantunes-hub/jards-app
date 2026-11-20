// GET /api/ticketeria/conexoes/meta/retorno: a volta do login da Meta (este é o endereço cadastrado no app da Meta). A conta toda está em lib/ticketeria/midia/retorno.ts.

import { type NextRequest } from "next/server";
import { concluirLogin } from "@/lib/ticketeria/midia/retorno";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => concluirLogin(req, "meta");
