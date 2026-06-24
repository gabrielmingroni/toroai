import type { RecentActivityItem, StandardCoverage } from "@/lib/types";

export const DASHBOARD_STATS = [
  { value: "3", label: "Active Projects", sub: "" },
  { value: "47", label: "Design Outputs", sub: "docs delivered" },
  { value: "1,185", label: "Tests Passing", sub: "0 failing" },
  { value: "$284,200", label: "Total BOM Value", sub: "across all projects" },
] as const;

export const RECENT_ACTIVITY: RecentActivityItem[] = [
  { project: "DeBakey VAMC B-108", activity: "ISP pipeline completed", time: "2h ago", color: "green" },
  { project: "City Hall Renovation", activity: "RCDD review pending", time: "8h ago", color: "amber" },
  { project: "Pearland ISD STEM", activity: "Floor plan uploaded", time: "1d ago", color: "blue" },
];

export const STANDARDS_COVERAGE: StandardCoverage[] = [
  { standard: "BICSI TDMM 15th Ed.", detail: "20 checks" },
  { standard: "TIA-568.1-D", detail: "90m + Cat6A" },
  { standard: "TIA-569-D", detail: "Tray fill ≤40%" },
  { standard: "TIA-607-C", detail: "TGB/TMGB" },
  { standard: "NEC Art. 800", detail: "Firestop" },
  { standard: "IEEE 802.3bt", detail: "PoE++" },
];

export const CURRENT_USER = {
  firstName: "Joseph",
  lastName: "Torres",
  rcddNumber: "12847",
  firmName: "Phoenix Infrastructure Services Group",
  city: "Houston, TX",
} as const;

export const SUBSCRIPTION = {
  tier: "RCDD Professional",
  designsUsed: 3,
  designsLimit: 10,
} as const;
