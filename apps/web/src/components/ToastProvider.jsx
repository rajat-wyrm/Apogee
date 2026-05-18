import { Toaster } from 'react-hot-toast';
export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: 'dark:bg-gray-800 dark:text-white',
        style: { borderRadius: '8px', padding: '12px' },
      }}
    />
  );
}
