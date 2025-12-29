import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import AuthProvider from "@/contexts/AuthContext";

// Import essential components directly (immediate loading)
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Home2 from "./pages/Home2";

// Lazy load internal pages (on-demand loading)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat").then(m => ({ default: m.default })));
const VideoPage = lazy(() => import("./pages/Video"));
const ImagePage = lazy(() => import("./pages/Image"));
const Image2Page = lazy(() => import("./pages/Image2"));
const TranslatorPage = lazy(() => import("./pages/Translator"));
const WritePage = lazy(() => import("./pages/Write"));
const TranscribePage = lazy(() => import("./pages/Transcribe"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Share = lazy(() => import("./pages/Share"));

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DashboardNovo = lazy(() => import("./pages/DashboardNovo"));
const Upscale = lazy(() => import("./pages/Upscale"));
const SkinEnhancer = lazy(() => import("./pages/SkinEnhancer"));
const ImageEditor = lazy(() => import("./pages/ImageEditor"));
const AIAvatar = lazy(() => import("./pages/AIAvatar"));

// Create queryClient
const queryClient = new QueryClient();

// Page loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Providers wrapper for all routes
const ProvidersWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

const App = () => (
  <BrowserRouter>
    <ProvidersWrapper>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home2 />} />
          <Route path="/home2" element={<Home2 />} /> {/* Alias for compatibility */}
          <Route path="/share" element={<Share />} />
          <Route path="/admin" element={<AdminLogin />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute><Chat /></ProtectedRoute>
          } />
          <Route path="/video" element={
            <ProtectedRoute><VideoPage /></ProtectedRoute>
          } />
          <Route path="/image" element={
            <ProtectedRoute><ImagePage /></ProtectedRoute>
          } />
          <Route path="/image2" element={
            <ProtectedRoute><Image2Page /></ProtectedRoute>
          } />
          <Route path="/translator" element={
            <ProtectedRoute><TranslatorPage /></ProtectedRoute>
          } />
          <Route path="/write" element={
            <ProtectedRoute><WritePage /></ProtectedRoute>
          } />
          <Route path="/transcribe" element={
            <ProtectedRoute><TranscribePage /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          } />
          <Route path="/dashboard-novo" element={
            <ProtectedRoute><DashboardNovo /></ProtectedRoute>
          } />
          <Route path="/upscale" element={
            <ProtectedRoute><Upscale /></ProtectedRoute>
          } />
          <Route path="/skin-enhancer" element={
            <ProtectedRoute><SkinEnhancer /></ProtectedRoute>
          } />
          <Route path="/image-editor" element={
            <ProtectedRoute><ImageEditor /></ProtectedRoute>
          } />
          <Route path="/ai-avatar" element={
            <ProtectedRoute><AIAvatar /></ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          
          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ProvidersWrapper>
  </BrowserRouter>
);

export default App;