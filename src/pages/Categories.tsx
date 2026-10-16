import { useState, type FormEvent } from 'react'
import { Plus, Tags } from 'lucide-react'
import { CategoryCard } from '@/components/CategoryCard'
import { ColorPicker, IconPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Feedback'
import { Field, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useFinance } from '@/contexts/FinanceContext'
import { useDb } from '@/hooks/useDb'
import type { Category, ColorKey, TxType } from '@/types'
import { categoryIndex } from '@/utils/finance'

const TABS: Array<{ value: TxType; label: string }> = [
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
]

interface FormState {
  editing?: Category
  parentId?: string
}

export default function Categories() {
  const { categories, transactions } = useFinance()
  const db = useDb()
  const [type, setType] = useState<TxType>('expense')
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const index = categoryIndex(categories)
  const roots = index.roots.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const usage = (category: Category) => {
    const ids = new Set([category.id, ...index.childrenOf(category.id).map((c) => c.id)])
    return transactions.filter((t) => t.category_id && ids.has(t.category_id)).length
  }
  const inUse = deleting ? usage(deleting) : 0
  const children = deleting ? index.childrenOf(deleting.id).length : 0

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Organize seus lançamentos. Crie, edite e exclua categorias e subcategorias."
        actions={
          <Button icon={Plus} onClick={() => setForm({})}>
            Nova categoria
          </Button>
        }
      />

      <Segmented label="Tipo de categoria" value={type} onChange={setType} options={TABS} className="mb-6" />

      {roots.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria por aqui"
            description="Crie categorias para classificar seus lançamentos."
            action={
              <Button icon={Plus} onClick={() => setForm({})}>
                Nova categoria
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roots.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              subcategories={index.childrenOf(category.id)}
              onEdit={(c) => setForm({ editing: c })}
              onDelete={setDeleting}
              onAddSub={(parent) => setForm({ parentId: parent.id })}
            />
          ))}
        </div>
      )}

      {form && <CategoryForm {...form} defaultType={type} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir categoria?"
        description={[
          `"${deleting?.name ?? ''}" será excluída.`,
          children > 0 ? `Suas ${children} subcategorias também.` : '',
          inUse > 0
            ? `${inUse} ${inUse === 1 ? 'lançamento ficará' : 'lançamentos ficarão'} sem categoria.`
            : 'Nenhum lançamento usa esta categoria.',
        ]
          .filter(Boolean)
          .join(' ')}
        onConfirm={async () => {
          if (deleting) await db.remove('categories', deleting.id, 'Categoria excluída')
        }}
      />
    </>
  )
}

interface CategoryFormProps extends FormState {
  defaultType: TxType
  onClose: () => void
}

function CategoryForm({ editing, parentId, defaultType, onClose }: CategoryFormProps) {
  const { categories } = useFinance()
  const db = useDb()
  const index = categoryIndex(categories)
  const hasChildren = editing ? index.childrenOf(editing.id).length > 0 : false

  const [name, setName] = useState(editing?.name ?? '')
  const [parent, setParent] = useState<string>(editing?.parent_id ?? parentId ?? '')
  const parentCategory = index.byId.get(parent)
  const type = parentCategory?.type ?? editing?.type ?? defaultType
  const [icon, setIcon] = useState(editing?.icon ?? parentCategory?.icon ?? 'dots')
  const [color, setColor] = useState<ColorKey>(editing?.color ?? parentCategory?.color ?? 'blue')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const parents = index.roots.filter((c) => c.type === type && c.id !== editing?.id)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Informe o nome.')
    const duplicate = categories.some(
      (c) =>
        c.id !== editing?.id &&
        c.type === type &&
        (c.parent_id ?? '') === parent &&
        c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) return setError('Já existe uma categoria com este nome.')

    // Subcategoria usa a cor da principal, para o gráfico agrupar com clareza.
    const row = {
      name: trimmed,
      icon,
      color: parentCategory?.color ?? color,
      type,
      parent_id: parent || null,
    }
    setSaving(true)
    const ok = editing
      ? await db.update('categories', editing.id, row, 'Categoria atualizada')
      : await db.create('categories', row, 'Categoria criada')
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar categoria' : parent ? 'Nova subcategoria' : 'Nova categoria'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" error={error ?? undefined}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pets" maxLength={40} />}
        </Field>
        {!hasChildren && (
          <Field label="Categoria principal" hint="Deixe em branco para criar uma categoria principal.">
            {(id) => (
              <Select id={id} value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">Nenhuma (é uma categoria principal)</option>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {!parentCategory && (
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">Cor</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        )}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Ícone</p>
          <IconPicker value={icon} onChange={setIcon} color={parentCategory?.color ?? color} />
        </div>
      </form>
    </Modal>
  )
}
