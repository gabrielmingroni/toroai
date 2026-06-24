import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export function StubPage({
  viewName,
  demoFunction,
  breadcrumb,
}: {
  viewName: string;
  demoFunction: string;
  breadcrumb: { label: string }[];
}) {
  return (
    <>
      <TopBar breadcrumb={breadcrumb} />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[700px]">
          <Card>
            <CardHeader title={`${viewName} — not yet ported`} />
            <CardBody>
              <p className="text-[12px] text-text2 mb-3">
                Not yet wired in this build. Visual reference lives in{" "}
                <code className="mono text-accent">toroai-demo-v8.html</code>{demoFunction !== "renderXxx" ? ` (${demoFunction})` : ""}. Port follows the Dashboard pattern:
                fixtures in <code className="mono text-accent">/lib/fixtures</code>, primitives in{" "}
                <code className="mono text-accent">/components/ui</code>.
              </p>
              <Link href="/dashboard" className="btn btn-ghost text-[11px]">
                ← Back to Dashboard
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
