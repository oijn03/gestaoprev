import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import Requests from "./pages/Requests";
import Consultations from "./pages/Consultations";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Notifications from "./pages/Notifications";
import LgpdPanel from "./pages/LgpdPanel";
import SettingsPage from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/casos" element={<ProtectedPage><Cases /></ProtectedPage>} />
            <Route path="/solicitacoes" element={<ProtectedPage><Requests /></ProtectedPage>} />
            <Route path="/consultas" element={<ProtectedPage><Consultations /></ProtectedPage>} />
            <Route path="/laudos" element={<ProtectedPage><Reports /></ProtectedPage>} />
            <Route path="/documentos" element={<ProtectedPage><Documents /></ProtectedPage>} />
            <Route path="/notificacoes" element={<ProtectedPage><Notifications /></ProtectedPage>} />
            <Route path="/lgpd" element={<ProtectedPage><LgpdPanel /></ProtectedPage>} />
            <Route path="/configuracoes" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
