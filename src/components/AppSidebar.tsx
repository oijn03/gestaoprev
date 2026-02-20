import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  ClipboardList,
  CalendarDays,
  Bell,
  Shield,
  LogOut,
  Settings,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const advogadoItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meus Casos", url: "/casos", icon: FolderOpen },
  { title: "Solicitações", url: "/solicitacoes", icon: ClipboardList },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
];

const medicoItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Solicitações", url: "/solicitacoes", icon: ClipboardList },
  { title: "Consultas", url: "/consultas", icon: CalendarDays },
  { title: "Laudos", url: "/laudos", icon: FileText },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
];

const especialistaItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Laudos", url: "/laudos", icon: FileText },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const items = role === "advogado" ? advogadoItems
    : role === "medico_generalista" ? medicoItems
    : role === "especialista" ? especialistaItems
    : [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }];

  const roleLabel = role === "advogado" ? "Advogado"
    : role === "medico_generalista" ? "Médico Generalista"
    : role === "especialista" ? "Especialista"
    : "Usuário";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Scale className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Gestão Prev.</span>
              <span className="text-xs text-sidebar-foreground/60">{roleLabel}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/lgpd"}>
                  <NavLink to="/lgpd" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                    <Shield className="h-4 w-4" />
                    <span>Privacidade LGPD</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/configuracoes"}>
                  <NavLink to="/configuracoes" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <p className="mb-2 truncate text-xs text-sidebar-foreground/70">{profile.full_name}</p>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
