import { useNavigate } from 'react-router-dom'
import { MultiCategoryEnhancer } from '@/components/admin/MultiCategoryEnhancer'
import { useAdminData } from '../AdminDataContext'
import type { Character } from '@/lib/types'

export default function BulkHabitatRoute(): React.JSX.Element {
  const { characters, refresh } = useAdminData()
  const navigate = useNavigate()

  const handleUpdateCharacters = (_chars: Character[]) => refresh()

  return (
    <div className="container mx-auto px-4 py-8">
      <MultiCategoryEnhancer
        characters={characters}
        onUpdateCharacters={handleUpdateCharacters}
        onBack={() => navigate(-1)}
      />
    </div>
  )
}
