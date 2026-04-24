import { useState } from 'react'
import type { Character } from '@/lib/types'
import { EnvironmentTest } from '@/components/EnvironmentTest'
import { CharacterPicker } from '../CharacterPicker'
import { useAdminData } from '../AdminDataContext'

export default function EnvTestRoute(): React.JSX.Element {
  const { refresh } = useAdminData()
  const [selected, setSelected] = useState<Character | null>(null)

  if (!selected) {
    return <CharacterPicker onSelect={setSelected} />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <EnvironmentTest
        character={selected}
        onUpdateCharacter={(c) => { setSelected(c); refresh() }}
        onBack={() => setSelected(null)}
      />
    </div>
  )
}
