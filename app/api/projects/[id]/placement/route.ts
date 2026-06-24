import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { placementStore } from "@/lib/placement/mock-store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  const state = placementStore.get(params.id, user.id);
  return NextResponse.json({ ok: true, state });
}

interface ActionBody {
  action:
    | "add_outlet" | "add_wap"
    | "remove_outlet" | "remove_wap"
    | "approve_outlet" | "approve_wap"
    | "reject_outlet" | "reject_wap"
    | "auto_outlets" | "auto_waps"
    | "approve_all_pending" | "clear_ai";
  payload?: any;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!projectStore.get(params.id, user.id)) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });

  const body = (await req.json()) as ActionBody;
  switch (body.action) {
    case "add_outlet": placementStore.addOutlet(params.id, user.id, body.payload); break;
    case "add_wap":    placementStore.addWap(params.id, user.id, body.payload); break;
    case "remove_outlet": placementStore.removeOutlet(params.id, user.id, body.payload.id); break;
    case "remove_wap":    placementStore.removeWap(params.id, user.id, body.payload.id); break;
    case "approve_outlet": placementStore.setOutletApproval(params.id, user.id, body.payload.id, "approved"); break;
    case "reject_outlet":  placementStore.setOutletApproval(params.id, user.id, body.payload.id, "rejected"); break;
    case "approve_wap":    placementStore.setWapApproval(params.id, user.id, body.payload.id, "approved"); break;
    case "reject_wap":     placementStore.setWapApproval(params.id, user.id, body.payload.id, "rejected"); break;
    case "auto_outlets": placementStore.autoPlaceOutlets(params.id, user.id); break;
    case "auto_waps":    placementStore.autoPlaceWaps(params.id, user.id); break;
    case "approve_all_pending": placementStore.approveAllPending(params.id, user.id); break;
    case "clear_ai":     placementStore.clearAi(params.id, user.id); break;
    default:
      return NextResponse.json({ ok: false, error: { code: "unknown_action", message: "Unknown action." } }, { status: 400 });
  }
  return NextResponse.json({ ok: true, state: placementStore.get(params.id, user.id) });
}
