import { motion } from 'framer-motion'

interface Props {
  damage: number
  hp: number
}

export function LethalWarning({ damage, hp }: Props) {
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-2 bg-red-600/90 rounded-lg border border-red-400 text-white font-bold"
      animate={{ opacity: [1, 0.6, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      <span className="text-lg">☠</span>
      <div>
        <div className="text-sm">LETHAL THREAT</div>
        <div className="text-xs font-normal">{damage} dmg incoming, only {hp} HP left</div>
      </div>
    </motion.div>
  )
}
