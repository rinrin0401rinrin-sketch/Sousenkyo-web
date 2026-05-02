import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Panel } from '../components/Panel';

export function NotFoundPage() {
  return (
    <AppShell>
      <Panel className="text-center">
        <p className="text-sm font-bold text-slate-500">404</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">ページが見つかりません</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          指定されたURLに対応するページがありません。選挙IDや都道府県IDを確認してください。
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-bold text-white"
        >
          トップへ戻る
        </Link>
      </Panel>
    </AppShell>
  );
}
