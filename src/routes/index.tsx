import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, type Role, type SellerScreen, type ManagerScreen } from "@/components/app-shell";
import { MyLeadsScreen } from "@/components/screens/my-leads";
import { PipelineScreen } from "@/components/screens/pipeline";
import { PerformanceScreen } from "@/components/screens/performance";
import { RescueScreen } from "@/components/screens/rescue";
import { ManagerDashboard } from "@/components/screens/manager-dashboard";
import { TeamScreen } from "@/components/screens/team";
import { AllLeadsScreen } from "@/components/screens/all-leads";
import { PlaceholderScreen } from "@/components/screens/placeholder";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [role, setRole] = useState<Role>("vendedor");
  const [screen, setScreen] = useState<SellerScreen | ManagerScreen>("leads");

  let content: React.ReactNode = null;
  if (role === "vendedor") {
    if (screen === "leads") content = <MyLeadsScreen />;
    else if (screen === "pipeline") content = <PipelineScreen />;
    else if (screen === "performance") content = <PerformanceScreen />;
    else content = <PlaceholderScreen title="Configuración" description="Ajustes de tu cuenta" />;
  } else {
    if (screen === "dashboard") content = <ManagerDashboard />;
    else if (screen === "all-leads") content = <AllLeadsScreen />;
    else if (screen === "team") content = <TeamScreen />;
    else if (screen === "rescue") content = <RescueScreen />;
    else if (screen === "reports") content = <PlaceholderScreen title="Reportes" description="Reportes detallados del concesionario" />;
    else content = <PlaceholderScreen title="Configuración" description="Ajustes generales" />;
  }

  return (
    <AppShell role={role} setRole={setRole} screen={screen} setScreen={setScreen}>
      {content}
    </AppShell>
  );
}
