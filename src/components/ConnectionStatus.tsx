import { motion } from 'framer-motion'
import { useConnected } from '@/hooks/useGameState'

export function ConnectionStatus() {
  const connected = useConnected()

  if (connected) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur rounded-lg border border-white/10 text-white/70 text-sm"
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-yellow-500"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      Waiting for STS2...
      <span className="text-xs text-white/40">Install STS2MCP mod to connect</span>
    </motion.div>
  )
}
