import { useState } from 'react'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  /** Ação destrutiva: botão vermelho. */
  danger?: boolean
  onConfirm: () => void | Promise<unknown>
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  danger = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">{description}</p>
    </Modal>
  )
}
