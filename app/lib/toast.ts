type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

class Toast {
  private createToast(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
    console.log(`${type.toUpperCase()}: ${message}`); // 临时使用console
  }

  success(message: string, options?: ToastOptions) {
    this.createToast(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    this.createToast(message, 'error', options);
  }

  info(message: string, options?: ToastOptions) {
    this.createToast(message, 'info', options);
  }

  warning(message: string, options?: ToastOptions) {
    this.createToast(message, 'warning', options);
  }
}

export const toast = new Toast(); 