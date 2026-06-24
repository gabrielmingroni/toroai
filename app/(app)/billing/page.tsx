import { StubPage } from "../(stubs)/StubPage";

export default function BillingPage() {
  return (
    <StubPage
      viewName="Billing"
      demoFunction="renderBilling"
      breadcrumb={[{ label: "Account" }, { label: "Billing" }]}
    />
  );
}
