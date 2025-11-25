import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  // Separate toasts by position
  const leftToasts = toasts.filter(toast => toast.position === "left")
  const rightToasts = toasts.filter(toast => toast.position !== "left")

  return (
    <ToastProvider>
      {/* Left viewport for AR validation toasts */}
      {leftToasts.map(function ({ id, title, description, action, position, ...props }) {
        return (
          <Toast key={id} {...props} data-position="left">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {leftToasts.length > 0 && <ToastViewport data-position="left" />}

      {/* Right viewport for all other toasts */}
      {rightToasts.map(function ({ id, title, description, action, position, ...props }) {
        return (
          <Toast key={id} {...props} data-position="right">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {rightToasts.length > 0 && <ToastViewport data-position="right" />}
    </ToastProvider>
  )
}
