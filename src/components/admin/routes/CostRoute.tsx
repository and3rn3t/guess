import { CostDashboard } from '@/components/CostDashboard'

export default function CostRoute(): React.JSX.Element {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <CostDashboard onBack={() => window.history.back()} />
    </div>
  )
}
