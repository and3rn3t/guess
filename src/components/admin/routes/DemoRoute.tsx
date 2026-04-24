import { QuestionGeneratorDemo } from '@/components/QuestionGeneratorDemo'

export default function DemoRoute(): React.JSX.Element {
  return (
    <div className="container mx-auto px-4 py-8">
      <QuestionGeneratorDemo onBack={() => window.history.back()} />
    </div>
  )
}
