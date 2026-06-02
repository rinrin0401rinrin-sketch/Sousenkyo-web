import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { specialPages } from '../data/specialPages';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const primaryNav = specialPages.slice(0, 3);
  const secondaryNav = specialPages.slice(3);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.22),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(226,232,240,0.9),transparent_30%),linear-gradient(135deg,#f8fafc,#eef2ff_45%,#f8fafc)]" />
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Election Studio</p>
            <p className="truncate text-base font-bold text-slate-950 sm:text-lg">選挙特番ダッシュボード</p>
          </Link>
          <nav className="hidden items-center gap-2 text-sm font-medium text-slate-600 lg:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm backdrop-blur-2xl">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
              JSON Live
            </span>
            <Link className="rounded-full px-3 py-2 hover:bg-slate-100" to="/">
              トップ
            </Link>
            {primaryNav.map((page) => (
              <Link key={page.id} className="rounded-full px-3 py-2 hover:bg-slate-100" to={page.path}>
                {page.title}
              </Link>
            ))}
            <Link className="rounded-full px-3 py-2 hover:bg-slate-100" to="/glossary">
              単語帳
            </Link>
          </nav>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 text-sm font-bold text-slate-600 sm:px-6 lg:hidden">
          <Link className="shrink-0 rounded-full bg-white/60 px-3 py-2" to="/">
            トップ
          </Link>
          {[...primaryNav, ...secondaryNav].map((page) => (
            <Link key={page.id} className="shrink-0 rounded-full bg-white/60 px-3 py-2" to={page.path}>
              {page.title}
            </Link>
          ))}
          <Link className="shrink-0 rounded-full bg-white/60 px-3 py-2" to="/glossary">
            単語帳
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
