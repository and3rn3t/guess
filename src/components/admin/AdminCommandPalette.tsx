import { Fragment, useState, useMemo } from 'react'
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
import { UsersIcon } from '@phosphor-icons/react'

export interface CommandSection {
  title: string
  items: Array<{ to: string; label: string; icon: React.ReactNode }>
}

interface AdminCommandPaletteProps {
  open: boolean
  onClose: () => void
  sections: CommandSection[]
  characters?: Array<{ id: string; name: string }>
}

const COMMON_COMMANDS: Array<{ label: string; to: string }> = [
  { label: 'Export game_stats as CSV', to: 'analytics' },
  { label: 'View recent errors', to: 'error-logs' },
  { label: 'Check data quality', to: 'data-quality' },
]

export function AdminCommandPalette({
  open,
  onClose,
  sections,
  characters = [],
}: AdminCommandPaletteProps): React.JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  // Filter characters by search
  const filteredCharacters = useMemo(() => {
    if (!search.trim() || search.length < 2) return []
    const lower = search.toLowerCase()
    return characters
      .filter((c) => c.name.toLowerCase().includes(lower))
      .slice(0, 5) // Limit to 5 results
  }, [search, characters])

  // Filter route sections by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections
    const lower = search.toLowerCase()
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(lower) ||
            item.to.toLowerCase().includes(lower)
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [search, sections])

  // Filter common commands by search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return []
    const lower = search.toLowerCase()
    return COMMON_COMMANDS.filter((cmd) => cmd.label.toLowerCase().includes(lower))
  }, [search])

  const handleSelect = (to: string) => {
    navigate(to)
    onClose()
  }

  const handleCommandSelect = (to: string) => {
    navigate(to)
    onClose()
  }

  const handleCharacterSelect = (id: string) => {
    navigate(`/admin/characters?id=${id}`)
    onClose()
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <CommandInput
        placeholder="Go to route, character, or command…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Route sections */}
        {filteredSections.map((section, i) => (
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

        {/* Characters */}
        {filteredCharacters.length > 0 && (
          <>
            {filteredSections.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Characters">
              {filteredCharacters.map((char) => (
                <CommandItem
                  key={char.id}
                  onSelect={() => handleCharacterSelect(char.id)}
                  className="gap-2"
                >
                  <UsersIcon size={16} className="text-muted-foreground" />
                  {char.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Common commands */}
        {filteredCommands.length > 0 && (
          <>
            {(filteredSections.length > 0 || filteredCharacters.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Commands">
              {filteredCommands.map((cmd) => (
                <CommandItem
                  key={cmd.label}
                  onSelect={() => handleCommandSelect(cmd.to)}
                  className="gap-2"
                >
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
