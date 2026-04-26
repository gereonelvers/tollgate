import { Nav } from "@/components/Nav";
import { DemoSetup } from "./demo-client";

export const metadata = { title: "Try the demo · Faregate" };

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Nav />
      <DemoSetup />
    </main>
  );
}
