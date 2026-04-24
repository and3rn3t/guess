import { useState } from 'react'
import type { Character } from '@/lib/types'
import { CategoryRecommender } from '@/components/CategoryRecommender'
import { CharacterPicker } from '../CharacterPicker'
import { useAdminData } from '../AdminDataContext'

export default function CategoryRecommenderRoute(): React.JSX.Element {
  const { refresh } = useAdminData()
  const [selected, setSelected] = useState<Character | null>(null)

  if (!selected) {
    return <CharacterPicker onSelect={setSelected} />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <CategoryRecommender
        character={selected}
        onUpdateCharacter={(c) => { setSelected(c); refresh() }}
        onBack={() => setSelected(null)}
      />
    </div>
  )
}
