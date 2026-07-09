// MIT Staff Console — env-synced dashboard shell (components/dashboard.tsx). Mock or live MIT telemetry
// through one render path, toggled by NEXT_PUBLIC_MOCKUP_MODE (.env.local).
import Dashboard from "@/components/dashboard";
import { AuthGate } from "@/components/auth-gate";

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
