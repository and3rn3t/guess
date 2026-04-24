import { DataHygiene } from '@/components/DataHygiene'
import { useAdminData } from '../AdminDataContext'
import type { Character, Question } from '@/lib/types'

export default function HygieneRoute(): React.JSX.Element {
  const { characters, questions, refresh } = useAdminData()

  const handleUpdateCharacter = (_c: Character) => refresh()
  const handleUpdateQuestion = (_q: Question) => refresh()

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <DataHygiene
        characters={characters}
        questions={questions}
        onUpdateCharacter={handleUpdateCharacter}
        onUpdateQuestion={handleUpdateQuestion}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
