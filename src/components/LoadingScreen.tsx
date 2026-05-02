export function LoadingScreen() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/85 p-8 text-center shadow-panel backdrop-blur-xl">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        <h1 className="text-xl font-bold text-slate-950">データを読み込み中</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">選挙データをJSONから取得しています。</p>
      </div>
    </div>
  );
}
