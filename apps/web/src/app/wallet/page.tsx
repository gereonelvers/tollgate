import { Nav } from "@/components/Nav";
import { WalletDashboard } from "./wallet-client";

export const metadata = { title: "Your wallet · Faregate" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <WalletDashboard />
    </main>
  );
}
