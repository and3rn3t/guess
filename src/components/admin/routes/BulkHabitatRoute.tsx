import { MultiCategoryEnhancer } from '@/components/MultiCategoryEnhancer'
import { useAdminData } from '../AdminDataContext'
import type { Character } from '@/lib/types'

export default function BulkHabitatRoute(): React.JSX.Element {
  const { characters, refresh } = useAdminData()

  const handleUpdateCharacters = (_chars: Character[]) => refresh()

  return (
    <div className="container mx-auto px-4 py-8">
      <MultiCategoryEnhancer
        characters={characters}
        onUpdateCharacters={handleUpdateCharacters}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
