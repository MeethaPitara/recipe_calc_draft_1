import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <CardTitle className="text-2xl">Something went wrong</CardTitle>
              </div>
              <CardDescription>
                We apologize for the inconvenience. The application encountered an unexpected error.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="font-mono text-sm text-destructive mb-2">
                    {this.state.error.toString()}
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        View stack trace
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-muted rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>You can try the following:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Click "Try Again" to reset the component</li>
                  <li>Reload the page to start fresh</li>
                  <li>Check your internet connection</li>
                  <li>If the problem persists, contact support</li>
                </ul>
              </div>
            </CardContent>
            
            <CardFooter className="flex gap-3">
              <Button onClick={this.handleReset} variant="default">
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                Reload Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
