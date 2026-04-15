import { useCodexStore } from '@/stores/codex-store'

export function useCodex() {
  return useCodexStore(s => s.data)
}

export function useCodexLoading() {
  return useCodexStore(s => s.isLoading)
}
