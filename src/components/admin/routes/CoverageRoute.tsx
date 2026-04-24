import { AttributeCoverageReport } from '@/components/AttributeCoverageReport'
import { useAdminData } from '../AdminDataContext'

export default function CoverageRoute(): React.JSX.Element {
  const { characters } = useAdminData()
  return (
    <div className="container mx-auto px-4 py-8">
      <AttributeCoverageReport characters={characters} onBack={() => window.history.back()} />
    </div>
  )
}
