type BoxLoaderProps = {
  label?: string;
};

export default function BoxLoader({ label = 'Loading your workspace...' }: BoxLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] px-6 text-center">
      <div className="grid grid-cols-2 gap-2" aria-hidden>
        <span className="h-5 w-5 animate-[pulse_1s_ease-in-out_infinite] rounded bg-[#141413]" />
        <span className="h-5 w-5 animate-[pulse_1s_ease-in-out_120ms_infinite] rounded bg-[#6A9BCC]" />
        <span className="h-5 w-5 animate-[pulse_1s_ease-in-out_240ms_infinite] rounded bg-[#D97757]" />
        <span className="h-5 w-5 animate-[pulse_1s_ease-in-out_360ms_infinite] rounded bg-[#788C5D]" />
      </div>
      <p className="mt-4 text-sm font-heading font-medium text-[#57544d]">{label}</p>
      <p className="mt-1 text-xs text-[#B0AEA5]">Syncing securely with your account...</p>
    </div>
  );
}
