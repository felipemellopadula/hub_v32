import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));

// Lazy load all route components for better code splitting
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const VideoPage = lazy(() => import("./pages/Video"));
const ImagePage = lazy(() => import("./pages/Image"));
const TranslatorPage = lazy(() => import("./pages/Translator"));
const WritePage = lazy(() => import("./pages/Write"));
const TranscribePage = lazy(() => import("./pages/Transcribe"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Share = lazy(() => import("./pages/Share"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Create queryClient lazily
let queryClient: QueryClient | null = null;
const getQueryClient = () => {
  if (!queryClient) {
    queryClient = new QueryClient();
  }
  return queryClient;
};

// Lightweight wrapper for app routes
const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </BrowserRouter>
);

// Heavy providers wrapper for authenticated routes
const ProvidersWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={getQueryClient()}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {children}
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => (
  <AppWrapper>
    <Routes>
      {/* Landing page - no heavy providers needed */}
      <Route path="/" element={<Index />} />
      <Route path="/share" element={<Share />} />
      <Route path="/admin" element={<AdminLogin />} />
      
      {/* Heavy routes wrapped with providers */}
      <Route path="/dashboard" element={
        <ProvidersWrapper>
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/chat" element={
        <ProvidersWrapper>
          <ProtectedRoute><Chat /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/video" element={
        <ProvidersWrapper>
          <ProtectedRoute><VideoPage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/image" element={
        <ProvidersWrapper>
          <ProtectedRoute><ImagePage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/translator" element={
        <ProvidersWrapper>
          <ProtectedRoute><TranslatorPage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/write" element={
        <ProvidersWrapper>
          <ProtectedRoute><WritePage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/transcribe" element={
        <ProvidersWrapper>
          <ProtectedRoute><TranscribePage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/settings" element={
        <ProvidersWrapper>
          <ProtectedRoute><SettingsPage /></ProtectedRoute>
        </ProvidersWrapper>
      } />
      <Route path="/admin/dashboard" element={
        <ProvidersWrapper>
          <AdminDashboard />
        </ProvidersWrapper>
      } />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppWrapper>
);

export default App;
