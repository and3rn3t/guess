import { Fragment } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useNavigate } from 'react-router-dom'

export interface CommandSection {
  title: string
  items: Array<{ to: string; label: string; icon: React.ReactNode }>
}

interface AdminCommandPaletteProps {
  open: boolean
  onClose: () => void
  sections: CommandSection[]
}

export function AdminCommandPalette({
  open,
  onClose,
  sections,
}: AdminCommandPaletteProps): React.JSX.Element {
  const navigate = useNavigate()

  const handleSelect = (to: string) => {
    navigate(to)
    onClose()
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <CommandInput placeholder="Go to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {sections.map((section, i) => (
          <Fragment key={section.title}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.to}
                  onSelect={() => handleSelect(item.to)}
                  className="gap-2"
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
