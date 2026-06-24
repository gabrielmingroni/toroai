import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth/session";

export function TopBar({ breadcrumb }: { breadcrumb: { href?: string; label: string }[] }) {
  const user = getCurrentUser();
  const display = user
    ? `${user.firstName[0]}. ${user.lastName}${user.rcddNumber ? ` · RCDD #${user.rcddNumber}` : ""}`
    : "Not signed in";

  return (
    <div className="h-11 border-b border-chrome-dark flex items-center px-5 gap-3 bg-chrome-dark flex-shrink-0">
      <div className="flex items-center gap-1.5 text-[12px]">
        {breadcrumb.map((crumb, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-text4">/</span>}
              <span className={isLast ? "text-text" : "text-text3"}>{crumb.label}</span>
            </span>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <input
          className="bg-chrome border border-chrome-lighter rounded-[2px] px-2.5 py-1 text-[12px] text-text placeholder:text-text4 outline-none focus:border-accent w-48"
          placeholder="Search..."
        />
        <Button variant="ghost" className="text-[11px]">{display}</Button>
      </div>
    </div>
  );
}
