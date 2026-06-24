import { StubPage } from "../(stubs)/StubPage";

export default function SettingsPage() {
  return (
    <StubPage
      viewName="Settings"
      demoFunction="renderSettings"
      breadcrumb={[{ label: "Account" }, { label: "Settings" }]}
    />
  );
}
