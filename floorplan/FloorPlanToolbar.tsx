"use client";

import clsx from "clsx";

export type Tool = "select" | "outlet" | "wap";

export function FloorPlanToolbar({
  tool, onTool,
  onAutoOutlets, onAutoWaps, onApproveAll, onClearAi, onDelete,
  pendingCount, outletCount, wapCount, busy,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  onAutoOutlets: () => void;
  onAutoWaps: () => void;
  onApproveAll: () => void;
  onClearAi: () => void;
  onDelete?: () => void;
  pendingCount: number;
  outletCount: number;
  wapCount: number;
  busy: boolean;
}) {
  return (
    <div className="bg-chrome-dark border-b border-divider px-4 py-2 flex items-center gap-2 flex-wrap">
      <Group title="Tool">
        <ToolBtn label="Select" hint="Esc" active={tool === "select"} onClick={() => onTool("select")} />
        <ToolBtn label="Place outlet" hint="O" active={tool === "outlet"} onClick={() => onTool("outlet")} />
        <ToolBtn label="Place WAP"    hint="W" active={tool === "wap"}    onClick={() => onTool("wap")} />
      </Group>

      <Separator />

      <Group title="AI auto-place">
        <Btn onClick={onAutoOutlets} disabled={busy} primary>Auto outlets</Btn>
        <Btn onClick={onAutoWaps}    disabled={busy}>Auto WAPs</Btn>
        <Btn onClick={onClearAi}     disabled={busy} ghost>Clear AI</Btn>
      </Group>

      <Separator />

      <Group title="Review">
        <Btn onClick={onApproveAll} disabled={busy || pendingCount === 0}>
          Approve {pendingCount > 0 ? `${pendingCount} pending` : "all"}
        </Btn>
        {onDelete && <Btn onClick={onDelete} danger>Delete selected</Btn>}
      </Group>

      <div className="ml-auto flex items-center gap-3 text-[11px] text-text3 font-mono">
        <span>{outletCount} outlets</span>
        <span className="text-text4">·</span>
        <span>{wapCount} WAPs</span>
        {pendingCount > 0 && (
          <span className="text-warn">· {pendingCount} pending</span>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="text-[8.5px] text-text4 uppercase tracking-[0.08em] font-mono mb-0.5">{title}</div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function ToolBtn({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1 rounded-[2px] text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-chrome-darkest"
          : "bg-chrome-light text-text2 hover:bg-chrome-lighter hover:text-text",
      )}
    >
      {label}{hint && <span className={clsx("ml-1.5 text-[9px] font-mono", active ? "text-chrome-darkest/60" : "text-text4")}>{hint}</span>}
    </button>
  );
}

function Btn({ children, onClick, disabled, primary, ghost, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  primary?: boolean; ghost?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "px-2.5 py-1 rounded-[2px] text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        primary && "bg-accent text-chrome-darkest hover:brightness-110",
        ghost   && "bg-transparent text-text3 hover:text-text",
        danger  && "bg-transparent text-fail border border-fail/40 hover:bg-fail/10",
        !primary && !ghost && !danger && "bg-chrome-light text-text2 hover:bg-chrome-lighter hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Separator() { return <div className="w-px h-9 bg-chrome-lighter mx-1" />; }
