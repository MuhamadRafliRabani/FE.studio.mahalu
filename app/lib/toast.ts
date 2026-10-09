import { toast } from "vue-sonner";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface AppToastOptions {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: ToastAction;
  cancel?: ToastAction;
}

export const appToast = {
  success: (message: string, options?: AppToastOptions) =>
    toast.success(message, { ...options }),

  error: (message: string, options?: AppToastOptions) =>
    toast.error(message, { ...options }),

  warning: (message: string, options?: AppToastOptions) =>
    toast.warning(message, { ...options }),

  info: (message: string, options?: AppToastOptions) =>
    toast.info(message, { ...options }),

  loading: (message: string, options?: AppToastOptions) =>
    toast.loading(message, { ...options }),

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
  ) => toast.promise(promise, messages),

  dismiss: (id?: string | number) => toast.dismiss(id),
};
