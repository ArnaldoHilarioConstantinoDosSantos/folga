import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço que você abriu não existe."
      action={
        <Link to="/" className="text-sm font-bold text-brand hover:underline">
          Voltar ao Dashboard
        </Link>
      }
    />
  )
}
