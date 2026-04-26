import { QuestionGeneratorDemo } from '@/components/QuestionGeneratorDemo'
import { useAdminData } from '../AdminDataContext'

export default function DemoRoute(): React.JSX.Element {
  const { characters, loading } = useAdminData()
  // Use a key so QuestionGeneratorDemo remounts once real characters are loaded,
  // preventing stale initialCharacters state from the loading phase.
  const demoKey = loading ? 'loading' : 'loaded'
  return (
    <div className="container mx-auto px-4 py-8">
      <QuestionGeneratorDemo
        key={demoKey}
        onBack={() => window.history.back()}
        initialCharacters={characters.length > 0 ? characters : undefined}
      />
    </div>
  )
}
