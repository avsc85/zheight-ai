// Re-export from AuthContext for backwards compatibility
// This file is kept for any external references but the actual implementation
// is now in src/contexts/AuthContext.tsx with React Query caching
export { useAuth } from '@/contexts/AuthContext';
