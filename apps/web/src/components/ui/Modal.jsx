import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', className }) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-sm',
            'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in',
            'data-[state=closed]:[animation-direction:reverse]'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'glass-strong rounded-2xl shadow-large p-6',
            'max-h-[92vh] overflow-y-auto',
            'focus:outline-none',
            'data-[state=open]:animate-scale-in',
            sizes[size],
            className
          )}
        >
          {(title || description) && (
            <div className="mb-5">
              {title && (
                <Dialog.Title className="text-lg font-semibold text-[var(--fg)] tracking-tight">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="mt-1 text-sm text-[var(--fg-subtle)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}
          <div>{children}</div>
          {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
          <Dialog.Close
            className="absolute right-4 top-4 rounded-md p-1.5 text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export default Modal;
