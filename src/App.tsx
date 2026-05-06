import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "./components/ui/error-boundary";
import { IngredientsProvider } from "@/contexts/IngredientsContext";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { isAdvancedMode } from "@/utils/feature-flags";

const queryClient = new QueryClient();

// Lazy-load all routes
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ReverseEngineer = lazy(() => import("./components/ReverseEngineer"));
const Glossary = lazy(() => import("./pages/Glossary"));
const Database = lazy(() => import("./pages/Database"));
const QuickProductionPlan = lazy(() => import("./pages/QuickProductionPlan"));
const BasePlanner = lazy(() => import("./pages/production/BasePlanner"));
const ExactPlan = lazy(() => import("./pages/production/ExactPlan"));

// Protected Route wrapper component — uses custom JWT auth
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AuthProvider>
            <IngredientsProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Suspense fallback={<div style={{ padding: '2rem' }}>Loading…</div>}>
                    <Routes>
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                      <Route path="/admin" element={<ProtectedRoute>{isAdvancedMode() ? <AdminPanel /> : <Navigate to="/" replace />}</ProtectedRoute>} />
                      <Route path="/reverse-engineer" element={<ProtectedRoute>{isAdvancedMode() ? <ReverseEngineer /> : <Navigate to="/" replace />}</ProtectedRoute>} />
                      <Route path="/help/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
                      <Route path="/database" element={<ProtectedRoute>{isAdvancedMode() ? <Database /> : <Navigate to="/" replace />}</ProtectedRoute>} />
                      <Route path="/production/quick-plan" element={<ProtectedRoute><QuickProductionPlan /></ProtectedRoute>} />
                      <Route path="/production/base-planner" element={<ProtectedRoute><BasePlanner /></ProtectedRoute>} />
                      <Route path="/production/exact-plan" element={<ProtectedRoute><ExactPlan /></ProtectedRoute>} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </TooltipProvider>
            </IngredientsProvider>
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
