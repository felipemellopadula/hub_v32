import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import VideoPage from "./pages/Video";
import ImagePage from "./pages/Image";
import TranslatorPage from "./pages/Translator";
import WritePage from "./pages/Write";
import TranscribePage from "./pages/Transcribe";
import SettingsPage from "./pages/Settings";
import Share from "./pages/Share";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/video" element={<ProtectedRoute><VideoPage /></ProtectedRoute>} />
          <Route path="/image" element={<ProtectedRoute><ImagePage /></ProtectedRoute>} />
          <Route path="/translator" element={<ProtectedRoute><TranslatorPage /></ProtectedRoute>} />
          <Route path="/write" element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
          <Route path="/transcribe" element={<ProtectedRoute><TranscribePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/share" element={<Share />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
