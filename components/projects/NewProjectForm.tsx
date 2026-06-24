"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { projectsClient } from "@/lib/projects/client";
import {
  BUILDING_TYPE_LABEL, SECTOR_LABEL, TYPE_LABEL,
  type BuildingType, type ProjectType, type Sector,
} from "@/lib/projects/types";
import { FieldError } from "@/components/auth/FieldError";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function NewProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Identity
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("isp");

  // Owner / AHJ
  const [owner, setOwner] = useState("");
  const [ahj, setAhj] = useState("");

  // Site
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("");

  // Building
  const [buildingType, setBuildingType] = useState<BuildingType>("new_construction");
  const [sector, setSector] = useState<Sector>("commercial_office");
  const [totalSf, setTotalSf] = useState("");
  const [floors, setFloors] = useState("1");
  const [occupancyDate, setOccupancyDate] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null); setFieldErrors({});
    startTransition(async () => {
      const res = await projectsClient.create({
        number, name, type, owner, ahj,
        addressLine1, city, state, zip,
        buildingType, sector,
        totalSf: parseInt(totalSf || "0", 10),
        floors: parseInt(floors || "0", 10),
        occupancyDate: occupancyDate || null,
      });
      if (!res.ok) {
        if (res.error?.field) setFieldErrors({ [res.error.field]: res.error.message });
        else setTopError(res.error?.message || "Failed to create project.");
        return;
      }
      router.push(`/projects/${res.project!.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      {/* Identity */}
      <Section title="Identity" subtitle="Project number, name, and design type">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Label htmlFor="number">Project number</Label>
            <input id="number" required className="input"
              placeholder="VAMC-2026-001"
              value={number} onChange={(e)=>setNumber(e.target.value)} />
            <FieldError message={fieldErrors.number} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="name">Project name</Label>
            <input id="name" required className="input"
              placeholder="DeBakey VAMC — Building B-108"
              value={name} onChange={(e)=>setName(e.target.value)} />
            <FieldError message={fieldErrors.name} />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="type">Design type</Label>
          <select id="type" className="input" value={type} onChange={(e)=>setType(e.target.value as ProjectType)}>
            {(Object.keys(TYPE_LABEL) as ProjectType[]).map(k => (
              <option key={k} value={k}>{TYPE_LABEL[k]}</option>
            ))}
          </select>
        </div>
      </Section>

      {/* Owner / AHJ */}
      <Section title="Owner & AHJ" subtitle="Facility owner and authority having jurisdiction">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="owner">Facility owner</Label>
            <input id="owner" required className="input"
              placeholder="U.S. Department of Veterans Affairs"
              value={owner} onChange={(e)=>setOwner(e.target.value)} />
            <FieldError message={fieldErrors.owner} />
          </div>
          <div>
            <Label htmlFor="ahj">AHJ</Label>
            <input id="ahj" required className="input"
              placeholder="City of Houston, TX"
              value={ahj} onChange={(e)=>setAhj(e.target.value)} />
            <FieldError message={fieldErrors.ahj} />
          </div>
        </div>
      </Section>

      {/* Site */}
      <Section title="Site" subtitle="Where the building is located">
        <div>
          <Label htmlFor="addressLine1">Street address</Label>
          <input id="addressLine1" required className="input"
            placeholder="2002 Holcombe Blvd"
            value={addressLine1} onChange={(e)=>setAddressLine1(e.target.value)} />
          <FieldError message={fieldErrors.addressLine1} />
        </div>
        <div className="grid grid-cols-6 gap-3 mt-3">
          <div className="col-span-3">
            <Label htmlFor="city">City</Label>
            <input id="city" required className="input"
              value={city} onChange={(e)=>setCity(e.target.value)} />
            <FieldError message={fieldErrors.city} />
          </div>
          <div className="col-span-1">
            <Label htmlFor="state">State</Label>
            <select id="state" className="input" value={state} onChange={(e)=>setState(e.target.value)}>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="zip">ZIP</Label>
            <input id="zip" required className="input" maxLength={5}
              value={zip} onChange={(e)=>setZip(e.target.value)} />
            <FieldError message={fieldErrors.zip} />
          </div>
        </div>
      </Section>

      {/* Scope */}
      <Section title="Scope" subtitle="Building type and size — drives BICSI sector defaults">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="buildingType">Building type</Label>
            <select id="buildingType" className="input" value={buildingType} onChange={(e)=>setBuildingType(e.target.value as BuildingType)}>
              {(Object.keys(BUILDING_TYPE_LABEL) as BuildingType[]).map(k => (
                <option key={k} value={k}>{BUILDING_TYPE_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sector">Sector</Label>
            <select id="sector" className="input" value={sector} onChange={(e)=>setSector(e.target.value as Sector)}>
              {(Object.keys(SECTOR_LABEL) as Sector[]).map(k => (
                <option key={k} value={k}>{SECTOR_LABEL[k]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <Label htmlFor="totalSf">Total SF</Label>
            <input id="totalSf" required type="number" min={1} className="input"
              placeholder="48200"
              value={totalSf} onChange={(e)=>setTotalSf(e.target.value)} />
            <FieldError message={fieldErrors.totalSf} />
          </div>
          <div>
            <Label htmlFor="floors">Floors</Label>
            <input id="floors" required type="number" min={1} className="input"
              value={floors} onChange={(e)=>setFloors(e.target.value)} />
            <FieldError message={fieldErrors.floors} />
          </div>
          <div>
            <Label htmlFor="occupancyDate">Target occupancy</Label>
            <input id="occupancyDate" type="date" className="input"
              value={occupancyDate} onChange={(e)=>setOccupancyDate(e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Submit */}
      {topError && (
        <div className="text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">
          {topError}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="btn btn-primary px-5 py-2.5 text-[13px] font-medium disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Creating project…" : "Create project"}
        </button>
        <Link href="/projects" className="btn btn-ghost text-[12px]">Cancel</Link>
        <span className="ml-auto text-[10.5px] text-text4 font-mono">
          Next step: upload architectural backgrounds for ingestion
        </span>
      </div>
    </form>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-header flex-col items-start py-2.5">
        <div className="card-title">{title}</div>
        {subtitle && <div className="text-[11px] text-text3 font-normal normal-case tracking-normal mt-0.5">{subtitle}</div>}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="field-label">{children}</label>;
}
