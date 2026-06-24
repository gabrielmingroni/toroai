// In-memory project store. Replaced by Postgres on the FastAPI side.
import type { Project, CreateProjectRequest, UpdateProjectRequest } from "./types";

const projects = new Map<string, Project>();

function seedIfEmpty() {
  if (projects.size > 0) return;
  const now = new Date().toISOString();
  const seed: Project[] = [
    {
      // ── Reduction-to-practice exhibit — ToroAI TDD §7 ────────────────────
      // SM 12-strand fiber, Building B-100 6th Floor → B-108 IT Closet
      // 2,300 LF OSP/ISP. Materials subtotal $9,118.00. LC/UPC connectors.
      // Federal VA Medical Center: Davis-Bacon prevailing wage applies.
      // Permit flags: Confined Space Entry, VA Federal Project, Davis-Bacon.
      // All values match the TDD verbatim so a runtime demo reproduces the
      // disclosure for utility-patent enablement.
      id: "P1",
      number: "VAMC-2026-001",
      name: "DeBakey VAMC — B-100 → B-108 SM 12-Strand Fiber",
      type: "isp_osp",
      status: "in_progress",
      owner: "U.S. Department of Veterans Affairs",
      ahj: "City of Houston, TX",
      addressLine1: "2002 Holcombe Blvd",
      city: "Houston", state: "TX", zip: "77030",
      buildingType: "renovation",
      sector: "healthcare",
      totalSf: 48200, floors: 6,
      occupancyDate: "2026-11-15",
      hasUpload: true,
      roomsConfirmed: 12,
      outlets: 24,
      waps: 0,
      bomTotalCents: 911_800,   // $9,118.00 per TDD §7
      complianceScore: { pass: 19, advisory: 1, fail: 0 },
      exhibit: {
        isTddExhibit: true,
        source: "TDD §7 — DeBakey VAMC reduction-to-practice exhibit",
        federalAgency: "VA",
        davisBaconApplies: true,
        permitFlags: [
          "Confined Space Entry Required",
          "VA Federal Project",
          "Davis-Bacon Prevailing Wage",
          "ROW / Excavation",
          "Directional Bore",
          "Aerial Attachment",
        ],
        cable: {
          type: "SM_OS2",
          strandCount: 12,
          totalLf: 2300,
          startLocation: "Building B-100, 6th Floor",
          endLocation: "Building B-108, IT Closet",
          connectorSpec: "LC_UPC",
        },
        bomMaterialsSubtotalCents: 911_800,
      },
      createdAt: "2026-02-04T12:14:00Z",
      updatedAt: "2026-05-10T08:42:00Z",
      createdBy: "u_001",
      firmId: null,
    },
    {
      id: "P2",
      number: "GOV-2026-014",
      name: "City Hall Renovation",
      type: "isp",
      status: "pending_review",
      owner: "City of Dallas",
      ahj: "City of Dallas, TX",
      addressLine1: "1500 Marilla St",
      city: "Dallas", state: "TX", zip: "75201",
      buildingType: "renovation",
      sector: "government_local",
      totalSf: 32500, floors: 3,
      occupancyDate: "2026-09-30",
      hasUpload: true,
      roomsConfirmed: 38,
      outlets: 41,
      waps: 6,
      bomTotalCents: 3_724_000,
      complianceScore: { pass: 19, advisory: 1, fail: 0 },
      createdAt: "2026-03-18T15:02:00Z",
      updatedAt: "2026-05-09T16:30:00Z",
      createdBy: "u_001",
      firmId: null,
    },
    {
      id: "P3",
      number: "EDU-2026-007",
      name: "Pearland ISD — STEM Campus",
      type: "isp_osp",
      status: "draft",
      owner: "Pearland ISD",
      ahj: "City of Pearland, TX",
      addressLine1: "2929 Bailey Rd",
      city: "Pearland", state: "TX", zip: "77584",
      buildingType: "new_construction",
      sector: "education_k12",
      totalSf: 28800, floors: 2,
      occupancyDate: "2027-08-15",
      hasUpload: false,
      roomsConfirmed: 0,
      outlets: 0,
      waps: 0,
      bomTotalCents: 0,
      complianceScore: { pass: 0, advisory: 0, fail: 0 },
      createdAt: "2026-04-22T11:00:00Z",
      updatedAt: "2026-04-22T11:00:00Z",
      createdBy: "u_001",
      firmId: null,
    },
  ];
  for (const p of seed) projects.set(p.id, p);
}
seedIfEmpty();

function nextId() {
  const existing = [...projects.keys()].filter(k => /^P\d+$/.test(k))
    .map(k => parseInt(k.slice(1), 10));
  const max = existing.length ? Math.max(...existing) : 0;
  return "P" + (max + 1);
}

export const projectStore = {
  list(userId: string): Project[] {
    return [...projects.values()]
      .filter(p => p.createdBy === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  get(id: string, userId: string): Project | undefined {
    const p = projects.get(id);
    if (!p || p.createdBy !== userId) return undefined;
    return p;
  },
  create(req: CreateProjectRequest, userId: string): Project {
    const id = nextId();
    const now = new Date().toISOString();
    const p: Project = {
      id,
      number: req.number,
      name: req.name,
      type: req.type,
      status: "draft",
      owner: req.owner,
      ahj: req.ahj,
      addressLine1: req.addressLine1,
      city: req.city,
      state: req.state,
      zip: req.zip,
      buildingType: req.buildingType,
      sector: req.sector,
      totalSf: req.totalSf,
      floors: req.floors,
      occupancyDate: req.occupancyDate ?? null,
      hasUpload: false,
      roomsConfirmed: 0,
      outlets: 0,
      waps: 0,
      bomTotalCents: 0,
      complianceScore: { pass: 0, advisory: 0, fail: 0 },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      firmId: null,
    };
    projects.set(id, p);
    return p;
  },
  update(id: string, userId: string, patch: UpdateProjectRequest): Project | undefined {
    const p = this.get(id, userId);
    if (!p) return undefined;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    return p;
  },
  remove(id: string, userId: string): boolean {
    const p = this.get(id, userId);
    if (!p) return false;
    projects.delete(id);
    return true;
  },
};
