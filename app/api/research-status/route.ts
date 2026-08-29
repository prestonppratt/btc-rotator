import { NextResponse } from "next/server"
import { buildResearchStatus } from "@/lib/research-status"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(buildResearchStatus(), {
    headers: { "Cache-Control": "no-store" },
  })
}
