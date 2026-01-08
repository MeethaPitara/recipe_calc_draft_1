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

const queryClient = new QueryClient();

// Lazy-load all routes that may import the Supabase client
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ReverseEngineer = lazy(() => import("./components/ReverseEngineer"));
const Glossary = lazy(() => import("./pages/Glossary"));
const Database = lazy(() => import("./pages/Database"));

// Protected Route wrapper component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setIsAuthenticated(!!session);
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
      }
    })();
  }, []);

  if (isAuthenticated === null) {
    return <div style={{padding:'2rem'}}>Loading...</div>;
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
                <Suspense fallback={<div style={{padding:'2rem'}}>Loading…</div>}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                    <Route path="/reverse-engineer" element={<ProtectedRoute><ReverseEngineer /></ProtectedRoute>} />
                    <Route path="/help/glossary" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
                    <Route path="/database" element={<ProtectedRoute><Database /></ProtectedRoute>} />
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
