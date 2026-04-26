import { Nav } from "@/components/Nav";
import { DeveloperPanel } from "./developer-client";

export const metadata = { title: "Developer · Faregate" };

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <DeveloperPanel />
    </main>
  );
}
