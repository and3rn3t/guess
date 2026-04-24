import { ClockIcon } from '@phosphor-icons/react'

interface ComingSoonProps {
  title: string
  description: string
}

export function ComingSoon({ title, description }: ComingSoonProps): React.JSX.Element {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <ClockIcon size={40} weight="duotone" className="mx-auto mb-4 text-muted-foreground/60" />
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
