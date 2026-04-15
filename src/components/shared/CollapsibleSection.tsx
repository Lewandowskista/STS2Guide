import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function CollapsibleSection({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90 w-full py-0.5"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? '' : '-rotate-90'}`}
        />
        {title}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
