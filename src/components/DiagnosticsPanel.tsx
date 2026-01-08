import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getSupabase, isBackendReady } from '@/integrations/supabase/safeClient';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export function DiagnosticsPanel() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnostics: DiagnosticResult[] = [];

    // Check 1: Backend Connection (replaces env var check since we have fallbacks)
    let supabase: any = null;
    try {
      supabase = await getSupabase();
      
      // Test actual connection with a simple query
      const { error: connectionError } = await supabase
        .from('ingredients')
        .select('id')
        .limit(1);
      
      if (connectionError) throw connectionError;
      
      diagnostics.push({
        name: 'Backend Connection',
        status: 'pass',
        message: 'Successfully connected to backend database'
      });

      // Check 3: Authentication Status
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        diagnostics.push({
          name: 'Authentication',
          status: session ? 'pass' : 'warning',
          message: session 
            ? `Logged in as ${session.user.email}` 
            : 'Not authenticated - some features may be limited'
        });
      } catch (authError: any) {
        diagnostics.push({
          name: 'Authentication',
          status: 'fail',
          message: `Auth check failed: ${authError.message}`
        });
      }

      // Check 4: Database Access
      try {
        const { data, error } = await supabase
          .from('ingredients')
          .select('count')
          .limit(1);
        
        if (error) throw error;
        
        diagnostics.push({
          name: 'Database Access',
          status: 'pass',
          message: 'Can query ingredients table'
        });
      } catch (dbError: any) {
        diagnostics.push({
          name: 'Database Access',
          status: 'fail',
          message: `Database query failed: ${dbError.message}`
        });
      }

    } catch (connectionError: any) {
      diagnostics.push({
        name: 'Backend Connection',
        status: 'fail',
        message: `Connection failed: ${connectionError.message}`
      });
    }

    // Check 5: LocalStorage
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      diagnostics.push({
        name: 'LocalStorage',
        status: 'pass',
        message: 'LocalStorage is available'
      });
    } catch (storageError: any) {
      diagnostics.push({
        name: 'LocalStorage',
        status: 'fail',
        message: 'LocalStorage is blocked or unavailable'
      });
    }

    setResults(diagnostics);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
    }
  };

  const overallStatus = results.every(r => r.status === 'pass') 
    ? 'pass' 
    : results.some(r => r.status === 'fail') 
    ? 'fail' 
    : 'warning';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getStatusIcon(overallStatus)}
            System Diagnostics
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRunning ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Running diagnostics...</p>
          </div>
        ) : (
          <>
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-sm">{result.name}</h4>
                    {getStatusBadge(result.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                </div>
              </div>
            ))}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Quick Actions</h4>
              <div className="space-y-2 text-sm">
                {overallStatus === 'fail' && (
                  <>
                    <p>• Open browser console (F12) to see detailed logs</p>
                    <p>• Try refreshing the page</p>
                    <p>• Clear browser cache and storage</p>
                    <p>• Check TROUBLESHOOTING.md for detailed help</p>
                  </>
                )}
                {overallStatus === 'warning' && (
                  <>
                    <p>• Some features may be limited</p>
                    <p>• Log in to access all features</p>
                    <p>• Run diagnostics again after logging in</p>
                  </>
                )}
                {overallStatus === 'pass' && (
                  <p className="text-green-700 font-medium">✅ All systems operational!</p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
