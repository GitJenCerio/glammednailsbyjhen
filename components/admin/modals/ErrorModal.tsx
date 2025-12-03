import { IoAlertCircleOutline } from 'react-icons/io5';

type ErrorModalProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function ErrorModal({ open, title = 'Error', message, onClose }: ErrorModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <IoAlertCircleOutline className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm sm:text-base text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors touch-manipulation"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

