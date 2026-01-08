import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Build SHA and cache version display with hard refresh button
 * Shows in bottom-right corner for cache busting and version tracking
 */
export default function FooterBuildTag() {
  const [clearing, setClearing] = useState(false);
  
  const sha = import.meta.env.VITE_COMMIT_HASH || 'dev';
  const version = import.meta.env.VITE_CACHE_VERSION || 'v1';
  
  const handleHardRefresh = async () => {
    setClearing(true);
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear all service worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Force reload from server (bypass cache)
    window.location.reload();
  };
  
  return (
    <div className="fixed bottom-2 right-2 z-50 flex items-center gap-2 text-[10px] opacity-60 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border/50">
      <span className="font-mono">
        Build: <span className="font-semibold">{sha.slice(0, 7)}</span>
      </span>
      <span className="text-muted-foreground">•</span>
      <span className="font-mono">
        Cache: <span className="font-semibold">{version}</span>
      </span>
      <span className="text-muted-foreground">•</span>
      <Button 
        variant="ghost" 
        size="sm"
        className="h-4 px-2 py-0 text-[10px] underline hover:no-underline"
        onClick={handleHardRefresh}
        disabled={clearing}
      >
        {clearing ? (
          <>
            <Loader2 className="mr-1 h-2 w-2 animate-spin" />
            Clearing...
          </>
        ) : (
          'Hard Refresh'
        )}
      </Button>
    </div>
  );
}
