import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import localforage from 'localforage'
import { IngredientsProvider } from './contexts/IngredientsContext'
import App from './App.tsx'
import './index.css'
import './styles/production.css'

// Configure localforage for better storage
localforage.config({
  name: 'meetha-pitara',
  storeName: 'query-cache',
  description: 'Offline cache for ingredient and recipe data'
});

// Create async persister using localforage
const persister = createAsyncStoragePersister({
  storage: localforage,
  key: 'MEETHA_PITARA_CACHE',
});

// Configure React Query with persistence-ready settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - cache remains fresh
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days - keep cache for a week
      refetchOnWindowFocus: true, // Revalidate from Supabase on focus
      refetchOnReconnect: true, // Revalidate from Supabase on reconnect
      refetchOnMount: true, // Revalidate from Supabase on mount
      retry: 1,
      // Network mode ensures we use cache when offline
      networkMode: 'offlineFirst',
    }
  }
})

createRoot(document.getElementById("root")!).render(
  <PersistQueryClientProvider 
    client={queryClient} 
    persistOptions={{ 
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // Persist for 7 days
      dehydrateOptions: {
        // Only persist successful queries
        shouldDehydrateQuery: (query) => {
          return query.state.status === 'success';
        }
      }
    }}
  >
    <IngredientsProvider>
      <App />
    </IngredientsProvider>
  </PersistQueryClientProvider>
);
