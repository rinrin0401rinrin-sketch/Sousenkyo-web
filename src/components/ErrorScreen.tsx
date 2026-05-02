type ErrorScreenProps = {
  title?: string;
  message: string;
};

export function ErrorScreen({ title = 'データを読み込めませんでした', message }: ErrorScreenProps) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-[2rem] border border-rose-100 bg-white/90 p-7 shadow-panel backdrop-blur-xl">
        <p className="mb-3 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
          Error
        </p>
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 break-words text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </div>
  );
}
