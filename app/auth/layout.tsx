import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BrandSplash } from "@/components/auth/BrandSplash";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (user) redirect("/projects");
  return (
    <div className="h-screen w-screen flex bg-chrome-darkest">
      <BrandSplash />
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
