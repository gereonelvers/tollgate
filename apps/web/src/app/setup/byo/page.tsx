import { Nav } from "@/components/Nav";
import { ByoSetup } from "./byo-client";

export const metadata = { title: "Connect your wallet · Faregate" };

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <ByoSetup />
    </main>
  );
}
