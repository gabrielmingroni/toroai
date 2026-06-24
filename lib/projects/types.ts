// Project domain types. Replaced by openapi-typescript when FastAPI is online.

export type ProjectStatus =
  | "draft"            // created, no documents uploaded
  | "intake"           // documents uploaded, ingestion in progress
  | "in_progress"      // design active
  | "pending_review"   // awaiting RCDD review
  | "ready_to_stamp"   // review complete, awaiting stamp
  | "complete"         // stamped and delivered
  | "archived";

export type ProjectType = "isp" | "osp" | "isp_osp";

export type BuildingType =
  | "new_construction"
  | "renovation"
  | "addition"
  | "tenant_improvement"
  | "mep_only";

export type Sector =
  | "healthcare"
  | "education_k12"
  | "education_higher_ed"
  | "government_federal"
  | "government_state"
  | "government_local"
  | "commercial_office"
  | "commercial_retail"
  | "commercial_hospitality"
  | "industrial_manufacturing"
  | "industrial_warehouse"
  | "mixed_use"
  | "residential_multifamily"
  | "data_center"
  | "transportation";

// ── Federal / regulatory classification ──────────────────────────────────
// Used by the post-processing enforcement modules (TDD §5.5):
//  • Davis-Bacon prevailing wage applies for federalAgency ∈ {VA, DOD, FAA, GSA}
//    or when davisBaconApplies is forced true.
//  • permitFlags drive the Regulatory Output Engine (TDD §6.4) — each flag is
//    a deterministic predicate that selects required permits + advisories.

export type FederalAgency = "VA" | "DOD" | "FAA" | "GSA" | "USACE" | "DOE";

/** Cable type — limited to the categories the TDD references explicitly. */
export type CableSpec =
  | "SM_OS2"        // single-mode OS2
  | "MM_OM3" | "MM_OM4" | "MM_OM5"
  | "CAT6" | "CAT6A";

/** Connector spec. TDD §5.5 explicitly prohibits LC/APC; LC/UPC is mandatory. */
export type ConnectorSpec = "LC_UPC" | "LC_APC" | "SC_UPC" | "ST_UPC";

/**
 * Reduction-to-practice exhibit data. When set, this project is the
 * verbatim ToroAI TDD §7 validation exhibit and reproduces the disclosed
 * scope, BOM target, and permit flags.
 */
export interface ProjectExhibit {
  /** Marks this project as the TDD reduction-to-practice exhibit. */
  isTddExhibit: boolean;
  /** Citation rendered in the UI — e.g. "TDD §7 — DeBakey VAMC". */
  source: string;
  /** Federal agency that owns / occupies the site. Triggers Davis-Bacon. */
  federalAgency?: FederalAgency;
  /** Hard true even if no federal agency is set (some state/local jobs qualify). */
  davisBaconApplies: boolean;
  /** Hard-coded permit flags from the disclosure. */
  permitFlags: string[];
  /** Fiber / copper cable scope of the disclosed installation. */
  cable: {
    type: CableSpec;
    strandCount: number;
    totalLf: number;
    startLocation: string;
    endLocation: string;
    connectorSpec: ConnectorSpec;
  };
  /** Materials subtotal as disclosed in the TDD (cents). */
  bomMaterialsSubtotalCents: number;
}

export interface Project {
  id: string;
  number: string;            // owner-assigned project number (e.g. "VAMC-2026-001")
  name: string;
  type: ProjectType;
  status: ProjectStatus;

  // Owner / AHJ
  owner: string;             // facility owner / client
  ahj: string;               // authority having jurisdiction

  // Site
  addressLine1: string;
  city: string;
  state: string;
  zip: string;

  // Building
  buildingType: BuildingType;
  sector: Sector;
  totalSf: number;
  floors: number;
  occupancyDate: string | null;  // ISO date — design target

  // Design state
  hasUpload: boolean;            // documents uploaded yet?
  roomsConfirmed: number;
  outlets: number;
  waps: number;
  bomTotalCents: number;         // last computed total
  complianceScore: { pass: number; advisory: number; fail: number };

  // Reduction-to-practice exhibit (set only on the TDD §7 demo project)
  exhibit?: ProjectExhibit;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;             // user id
  firmId: string | null;
}

export interface CreateProjectRequest {
  number: string;
  name: string;
  type: ProjectType;
  owner: string;
  ahj: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  buildingType: BuildingType;
  sector: Sector;
  totalSf: number;
  floors: number;
  occupancyDate?: string | null;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  status?: ProjectStatus;
}

export interface ProjectListFilters {
  query?: string;
  status?: ProjectStatus | "all";
  type?: ProjectType | "all";
  sector?: Sector | "all";
  sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "sf_desc";
}

export interface ProjectListResponse {
  ok: boolean;
  items: Project[];
  total: number;
}

export interface ProjectResponse {
  ok: boolean;
  project?: Project;
  error?: { code: string; message: string; field?: string };
}

// ── Display label maps ─────────────────────────────────────────────────────
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft:           "Draft",
  intake:          "Document Intake",
  in_progress:     "In Progress",
  pending_review:  "Pending Review",
  ready_to_stamp:  "Ready to Stamp",
  complete:        "Complete",
  archived:        "Archived",
};

export const TYPE_LABEL: Record<ProjectType, string> = {
  isp: "ISP", osp: "OSP", isp_osp: "ISP + OSP",
};

export const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  new_construction:   "New Construction",
  renovation:         "Renovation",
  addition:           "Addition",
  tenant_improvement: "Tenant Improvement",
  mep_only:           "MEP Only",
};

export const FEDERAL_AGENCY_LABEL: Record<FederalAgency, string> = {
  VA:    "U.S. Department of Veterans Affairs",
  DOD:   "U.S. Department of Defense",
  FAA:   "Federal Aviation Administration",
  GSA:   "General Services Administration",
  USACE: "U.S. Army Corps of Engineers",
  DOE:   "U.S. Department of Energy",
};

export const CABLE_SPEC_LABEL: Record<CableSpec, string> = {
  SM_OS2: "SM OS2 (single-mode)",
  MM_OM3: "MM OM3 (multi-mode)",
  MM_OM4: "MM OM4 (multi-mode)",
  MM_OM5: "MM OM5 (multi-mode)",
  CAT6:   "Cat 6",
  CAT6A:  "Cat 6A",
};

export const CONNECTOR_SPEC_LABEL: Record<ConnectorSpec, string> = {
  LC_UPC: "LC/UPC",
  LC_APC: "LC/APC",
  SC_UPC: "SC/UPC",
  ST_UPC: "ST/UPC",
};

export const SECTOR_LABEL: Record<Sector, string> = {
  healthcare:                 "Healthcare",
  education_k12:              "Education — K-12",
  education_higher_ed:        "Education — Higher Ed",
  government_federal:         "Government — Federal",
  government_state:           "Government — State",
  government_local:           "Government — Local",
  commercial_office:          "Commercial — Office",
  commercial_retail:          "Commercial — Retail",
  commercial_hospitality:     "Commercial — Hospitality",
  industrial_manufacturing:   "Industrial — Manufacturing",
  industrial_warehouse:       "Industrial — Warehouse",
  mixed_use:                  "Mixed Use",
  residential_multifamily:    "Residential — Multifamily",
  data_center:                "Data Center",
  transportation:             "Transportation",
};
