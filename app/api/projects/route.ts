import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import type { CreateProjectRequest } from "@/lib/projects/types";

const REQUIRED: (keyof CreateProjectRequest)[] = [
  "number", "name", "type", "owner", "ahj",
  "addressLine1", "city", "state", "zip",
  "buildingType", "sector", "totalSf", "floors",
];

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const items = projectStore.list(user.id);
  return NextResponse.json({ ok: true, items, total: items.length });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json()) as CreateProjectRequest;
  for (const field of REQUIRED) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return NextResponse.json(
        { ok: false, error: { code: "missing_fields", message: `Field "${field}" is required.`, field } },
        { status: 400 }
      );
    }
  }
  if (typeof body.totalSf !== "number" || body.totalSf <= 0) {
    return NextResponse.json({ ok: false, error: { code: "invalid_sf", message: "Total SF must be positive.", field: "totalSf" } }, { status: 400 });
  }
  if (typeof body.floors !== "number" || body.floors < 1) {
    return NextResponse.json({ ok: false, error: { code: "invalid_floors", message: "Floors must be at least 1.", field: "floors" } }, { status: 400 });
  }
  const project = projectStore.create(body, user.id);
  return NextResponse.json({ ok: true, project }, { status: 201 });
}
