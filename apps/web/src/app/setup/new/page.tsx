import { Nav } from "@/components/Nav";
import { NewSetup } from "./new-client";

export const metadata = { title: "Create new wallet · Faregate" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <NewSetup />
    </main>
  );
}
