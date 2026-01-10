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

// Lazy load internal pages (on-demand loading)
const VideoPage = lazy(() => import("./pages/Video"));
const Image2Page = lazy(() => import("./pages/Image2"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DashboardNovo = lazy(() => import("./pages/DashboardNovo"));
const Upscale = lazy(() => import("./pages/Upscale"));
const SkinEnhancer = lazy(() => import("./pages/SkinEnhancer"));
const ImageEditor = lazy(() => import("./pages/ImageEditor"));
const AIAvatar = lazy(() => import("./pages/AIAvatar"));
const Inpaint = lazy(() => import("./pages/Inpaint"));
const Storyboard = lazy(() => import("./pages/Storyboard"));
const Home3 = lazy(() => import("./pages/Home3"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

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
          <Route path="/" element={<Home3 />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/termos" element={<TermsOfService />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<AdminLogin />} />
          
          {/* Protected routes */}
          <Route path="/video" element={
            <ProtectedRoute><VideoPage /></ProtectedRoute>
          } />
          <Route path="/image2" element={
            <ProtectedRoute><Image2Page /></ProtectedRoute>
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
          <Route path="/inpaint" element={
            <ProtectedRoute><Inpaint /></ProtectedRoute>
          } />
          <Route path="/storyboard" element={
            <ProtectedRoute><Storyboard /></ProtectedRoute>
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
