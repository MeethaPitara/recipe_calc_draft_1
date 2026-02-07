import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { mlScheduler } from "@/lib/mlTrainingScheduler";
import ErrorBoundary from "./components/ui/error-boundary";
import { IngredientsProvider } from "@/contexts/IngredientsContext";
import { getSupabase } from "@/integrations/supabase/safeClient";
import { isAdvancedMode } from "@/utils/feature-flags";

const queryClient = new QueryClient();

// Lazy-load all routes that may import the Supabase client
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

// Protected Route wrapper component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const supabase = await getSupabase();

        if (!mounted) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setIsAuthenticated(!!session);
        }

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setIsAuthenticated(!!session);
          }
        });
        authSubscription = data.subscription;

        if (!mounted && authSubscription) {
          authSubscription.unsubscribe();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (mounted) {
          setIsAuthenticated(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  if (isAuthenticated === null) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => {
  // Initialize ML auto-training scheduler
  useEffect(() => {
    console.log('🚀 Initializing ML training scheduler...');
    mlScheduler.start().catch(err => {
      console.log('ML scheduler initialization deferred:', err.message);
    });

    return () => mlScheduler.stop();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
