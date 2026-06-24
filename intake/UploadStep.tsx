"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";
import type { Project } from "@/lib/projects/types";

type StagedFile = { name: string; sizeBytes: number; kind: "pdf" | "dwg" | "dxf" | "ifc" | "other" };

function detectKind(name: string): StagedFile["kind"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "dwg") return "dwg";
  if (ext === "dxf") return "dxf";
  if (ext === "ifc") return "ifc";
  return "other";
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const KIND_ICON: Record<StagedFile["kind"], string> = {
  pdf: "PDF", dwg: "DWG", dxf: "DXF", ifc: "IFC", other: "FILE",
};

export function UploadStep({ project, onStart }: { project: Project; onStart: (files: StagedFile[]) => void }) {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fl: FileList | File[]) => {
    const list = Array.from(fl).map(f => ({
      name: f.name,
      sizeBytes: f.size,
      kind: detectKind(f.name),
    }));
    setFiles(prev => [...prev, ...list]);
  }, []);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold mb-0.5">Upload architectural backgrounds</h1>
        <p className="text-[11.5px] text-text3 font-mono">
          Drop in the floor plans the architect sent. PDF preferred. DWG / DXF / IFC also accepted.
        </p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-[3px] py-12 px-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-accent bg-accent/5"
            : "border-chrome-lighter bg-chrome hover:border-text4",
        )}
      >
        <div className="text-[14px] text-text mb-1">Drag files here, or click to browse</div>
        <div className="text-[11.5px] text-text3 font-mono">
          PDF · DWG · DXF · IFC — multiple files OK
        </div>
        <input
          ref={inputRef} type="file" multiple
          accept=".pdf,.dwg,.dxf,.ifc"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="card mt-5">
          <div className="card-header">
            <div className="card-title">{files.length} file{files.length !== 1 ? "s" : ""} staged</div>
            <button onClick={() => setFiles([])} className="text-[10.5px] text-text3 hover:text-text font-mono">Clear</button>
          </div>
          <ul className="card-body p-0">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-chrome-dark last:border-b-0">
                <span className="inline-flex items-center justify-center w-10 h-7 bg-chrome-dark border border-chrome-lighter rounded-[2px] text-[9.5px] font-mono text-text2 font-medium">
                  {KIND_ICON[f.kind]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-text2 truncate">{f.name}</div>
                  <div className="text-[10.5px] text-text4 font-mono">{formatBytes(f.sizeBytes)}</div>
                </div>
                <button
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-text4 hover:text-fail text-[14px] px-2"
                  aria-label="Remove file"
                >×</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={() => onStart(files)}
          disabled={files.length === 0}
          className="btn btn-primary px-5 py-2.5 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Begin ingestion →
        </button>
        <span className="text-[10.5px] text-text4 font-mono">
          Ingestion runs <span className="text-text3">RoomAssembler → RoomClassifier → TRScorer</span>
        </span>
      </div>

      <div className="mt-8 text-[10.5px] text-text4 font-mono">
        Project {project.number} · {project.totalSf.toLocaleString()} SF · {project.floors} floor{project.floors !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
