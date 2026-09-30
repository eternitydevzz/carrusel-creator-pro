import { NextResponse } from "next/server";
import { listarCarruseles } from "@/lib/motor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listarCarruseles());
}
