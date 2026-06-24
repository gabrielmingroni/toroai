"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import type {
  DesignParameters, DesignResults,
  HorizontalMedia, BackboneMedia, WapStandard, TargetSpeed, Redundancy, OutletType,
} from "@/lib/design/types";
import {
  HORIZONTAL_LABEL, BACKBONE_LABEL, WAP_LABEL, SPEED_LABEL, REDUNDANCY_LABEL, OUTLET_LABEL,
} from "@/lib/design/types";
import { designClient } from "@/lib/design/client";
import { ParameterSection } from "./ParameterSection";
import { ResultsPanel } from "./ResultsPanel";

export function PreDesignEditor({
  project, sectorLabel, sectorRationale,
  initialParameters, initialResults, hasIntake,
}: {
  project: Project;
  sectorLabel: string;
  sectorRationale: string;
  initialParameters: DesignParameters;
  initialResults: DesignResults;
  hasIntake: boolean;
}) {
  const router = useRouter();
  const [params, setParams] = useState<DesignParameters>(initialParameters);
  const [results, setResults] = useState<DesignResults>(initialResults);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [continuing, startContinue] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function patch(p: Partial<DesignParameters>) {
    const merged = { ...params, ...p, updatedAt: new Date().toISOString() } as DesignParameters;
    setParams(merged);
    setSaving("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await designClient.update(project.id, p);
      if (res.ok && res.results) setResults(res.results);
      if (res.ok && res.parameters) setParams(res.parameters);
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    }, 350);
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  async function resetToDefaults() {
    setSaving("saving");
    const res = await designClient.reset(project.id);
    if (res.ok && res.parameters) setParams(res.parameters);
    // Re-fetch results
    const r = await designClient.get(project.id);
    if (r.ok && r.results) setResults(r.results);
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1200);
  }

  function onContinue() {
    startContinue(() => {
      router.push(`/projects/${project.id}/floor-plan`);
    });
  }

  return (
    <div className="flex flex-col">
      {/* Sector banner */}
      <div className="bg-chrome-dark border-b border-divider px-6 py-3 flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-3 mb-0.5">
            <h1 className="text-[16px] font-semibold">{project.name}</h1>
            <span className="text-[10.5px] text-text3 font-mono">{project.number}</span>
          </div>
          <div className="text-[11px] text-text3">
            <span className="text-accent font-medium">{sectorLabel}</span>
            {sectorRationale && <span className="ml-2 text-text3">— {sectorRationale}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10.5px] text-text4 font-mono">
            {saving === "saving" ? "Saving…" : saving === "saved" ? "✓ Saved" : `Updated ${new Date(params.updatedAt).toLocaleTimeString()}`}
          </span>
          <button onClick={resetToDefaults} className="btn btn-ghost text-[11px]">Reset to sector defaults</button>
        </div>
      </div>

      {!hasIntake && (
        <div className="px-6 pt-4">
          <div className="border border-warn/30 bg-warn/5 rounded-[2px] px-4 py-3 text-[11.5px] text-text2">
            No intake confirmed yet — calculations use a 55% workarea estimate from total SF.{" "}
            <Link href={`/projects/${project.id}/upload`} className="text-accent hover:underline">Run document intake</Link>{" "}
            to base the design on confirmed rooms.
          </div>
        </div>
      )}

      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 max-w-[1200px]">

        {/* Parameter columns */}
        <div className="space-y-4">

          <ParameterSection title="Workarea" cite="BICSI TDMM 15 §12.4.2 · density and growth">
            <NumberField
              label="Density"
              suffix="SF / WS"
              hint={`Sector default · ${sectorLabel}`}
              value={params.workareaDensity}
              min={20} max={2000} step={5}
              onChange={(v) => patch({ workareaDensity: v })}
            />
            <NumberField
              label="Growth factor"
              suffix="%"
              hint="BICSI recommends 30% over the lifecycle"
              value={Math.round(params.growthFactor * 100)}
              min={0} max={100} step={5}
              onChange={(v) => patch({ growthFactor: v / 100 })}
            />
          </ParameterSection>

          <ParameterSection title="Cabling" cite="TIA-568.1-D §6 · horizontal + backbone media">
            <SelectField<HorizontalMedia>
              label="Horizontal media"
              value={params.horizontalMedia}
              options={(Object.keys(HORIZONTAL_LABEL) as HorizontalMedia[]).map((k) => [k, HORIZONTAL_LABEL[k]])}
              onChange={(v) => patch({ horizontalMedia: v })}
            />
            <SelectField<BackboneMedia>
              label="Backbone media"
              value={params.backboneMedia}
              options={(Object.keys(BACKBONE_LABEL) as BackboneMedia[]).map((k) => [k, BACKBONE_LABEL[k]])}
              onChange={(v) => patch({ backboneMedia: v })}
            />
            <SelectField<OutletType>
              label="Outlet type"
              value={params.outletType}
              options={(Object.keys(OUTLET_LABEL) as OutletType[]).map((k) => [k, OUTLET_LABEL[k]])}
              onChange={(v) => patch({ outletType: v })}
            />
            <SelectField<1 | 2 | 3 | 4>
              label="Ports per outlet"
              value={params.portsPerOutlet}
              options={[[1, "1 port"], [2, "2 ports (default)"], [3, "3 ports"], [4, "4 ports (high-density)"]]}
              onChange={(v) => patch({ portsPerOutlet: v })}
            />
          </ParameterSection>

          <ParameterSection title="Wireless" cite="BICSI TDMM 15 §12.3 · WAP coverage">
            <SelectField<WapStandard>
              label="WAP standard"
              value={params.wapStandard}
              options={(Object.keys(WAP_LABEL) as WapStandard[]).map((k) => [k, WAP_LABEL[k]])}
              onChange={(v) => patch({ wapStandard: v })}
            />
            <NumberField
              label="Coverage radius"
              suffix="ft"
              hint="Per-AP radius for sector planning"
              value={params.wapCoverageRadiusFt}
              min={15} max={120} step={5}
              onChange={(v) => patch({ wapCoverageRadiusFt: v })}
            />
          </ParameterSection>

          <ParameterSection title="Network" cite="TIA-568.1-D · port speed and redundancy">
            <SelectField<TargetSpeed>
              label="Target port speed"
              value={params.targetPortSpeed}
              options={(Object.keys(SPEED_LABEL) as TargetSpeed[]).map((k) => [k, SPEED_LABEL[k]])}
              onChange={(v) => patch({ targetPortSpeed: v })}
            />
            <SelectField<Redundancy>
              label="Redundancy posture"
              value={params.redundancy}
              options={(Object.keys(REDUNDANCY_LABEL) as Redundancy[]).map((k) => [k, REDUNDANCY_LABEL[k]])}
              onChange={(v) => patch({ redundancy: v })}
            />
          </ParameterSection>

          <ParameterSection title="Lifecycle & Compliance" cite="BICSI TDMM 15 §2 · long-term planning">
            <SelectField<15 | 20 | 25>
              label="Design lifecycle"
              value={params.lifecycleYears}
              options={[[15, "15 years"], [20, "20 years (BICSI default)"], [25, "25 years (institutional)"]]}
              onChange={(v) => patch({ lifecycleYears: v })}
            />
            <SelectField<0.30 | 0.40>
              label="Cable tray fill target"
              value={params.trayFillTarget}
              options={[[0.30, "30% (conservative)"], [0.40, "40% — TIA-569-D §8 limit"]]}
              onChange={(v) => patch({ trayFillTarget: v })}
            />
            <StandardsLockRow params={params} />
          </ParameterSection>

        </div>

        {/* Live results panel */}
        <ResultsPanel results={results} parameters={params} />
      </div>

      <footer className="border-t border-chrome-dark px-6 py-4 flex items-center gap-3 bg-chrome-dark">
        <Link href={`/projects/${project.id}`} className="btn btn-ghost text-[11.5px]">← Back to project</Link>
        <span className="text-[10.5px] text-text4 font-mono ml-2">
          Parameters auto-save. Next step places outlets + WAPs on the floor plan.
        </span>
        <button onClick={onContinue} disabled={continuing}
          className="ml-auto btn btn-primary text-[13px] px-5 py-2.5 font-medium disabled:opacity-60">
          {continuing ? "Loading…" : "Continue to Floor Plan →"}
        </button>
      </footer>
    </div>
  );
}

// ── Field primitives ────────────────────────────────────────────────────────

function NumberField({
  label, suffix, hint, value, min, max, step, onChange,
}: {
  label: string; suffix?: string; hint?: string;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-chrome-dark last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text2">{label}</div>
        {hint && <div className="text-[10.5px] text-text4 mt-0.5 font-mono">{hint}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          className="input w-24 text-right text-[12px] py-1.5 font-mono tabular-nums"
          value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        {suffix && <span className="text-[10.5px] text-text3 font-mono w-14">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField<T extends string | number>({
  label, value, options, onChange,
}: {
  label: string; value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-chrome-dark last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text2">{label}</div>
      </div>
      <select
        className="input w-[260px] text-[11.5px] py-1.5 flex-shrink-0"
        value={String(value)}
        onChange={(e) => {
          const next = typeof options[0][0] === "number" ? Number(e.target.value) : e.target.value;
          onChange(next as T);
        }}
      >
        {options.map(([k, label]) => (
          <option key={String(k)} value={String(k)}>{label}</option>
        ))}
      </select>
    </div>
  );
}

function StandardsLockRow({ params }: { params: DesignParameters }) {
  return (
    <div className="pt-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-text4 mb-1.5">Standards locked for this project</div>
      <div className="flex flex-wrap gap-1">
        <Stamp>{params.standards.bicsi}</Stamp>
        <Stamp>{params.standards.tia568}</Stamp>
        <Stamp>{params.standards.tia569}</Stamp>
        <Stamp>{params.standards.tia607}</Stamp>
        <Stamp>NEC {params.standards.nec}</Stamp>
        <Stamp>{params.standards.poePlus}</Stamp>
      </div>
    </div>
  );
}
function Stamp({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded-[2px] bg-chrome-dark border border-chrome-lighter text-[9.5px] font-mono text-text2">
      {children}
    </span>
  );
}
