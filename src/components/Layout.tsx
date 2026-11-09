import { BookOpenText, Brain, Home, Layers, ListChecks, NotebookPen, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { WORDS } from '../data/words';
import { isDue } from '../lib/srs';
import { useProgress } from '../store/progress';

const NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/words', label: '단어장', icon: BookOpenText },
  { to: '/flash', label: '플래시카드', icon: Layers },
  { to: '/quiz', label: '객관식', icon: ListChecks },
  { to: '/review', label: '복습', icon: Brain, badge: 'due' as const },
  { to: '/wrong', label: '오답노트', icon: NotebookPen, badge: 'wrong' as const },
  { to: '/settings', label: '설정', icon: SettingsIcon },
];

function useTheme() {
  const theme = useProgress((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function useBadges() {
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  return useMemo(() => {
    const now = new Date();
    const known = new Set(WORDS.map((w) => w.id));
    const due = Object.entries(cards).filter(([id, c]) => known.has(id) && isDue(c, now)).length;
    const wrongN = Object.keys(wrong).filter((id) => known.has(id)).length;
    return { due, wrong: wrongN };
  }, [cards, wrong]);
}

export function Layout() {
  useTheme();
  const badges = useBadges();
  const navigate = useNavigate();
  const location = useLocation();
  const inSession = /^\/(flash|quiz|review)\/(play|session)/.test(location.pathname);

  // "/" 를 누르면 어디서든 단어 검색으로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        navigate('/words?focus=1');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen md:pl-60">
      {/* 사이드바 (데스크톱) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-6 pb-6 pt-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[17px] font-black text-white shadow-sm dark:text-[#0e1018]">
            W
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">Quiz Word</div>
            <div className="text-[11.5px] text-muted">CCAR-F 영어 단어장</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-primary-soft text-primary-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="flex-1">{label}</span>
              {badge && badges[badge] > 0 && (
                <span
                  className={`rounded-full px-2 py-px text-[11px] font-bold ${
                    badge === 'due' ? 'bg-primary text-white dark:text-[#0e1018]' : 'bg-danger-soft text-danger'
                  }`}
                >
                  {badges[badge]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 pb-6 text-[11.5px] leading-relaxed text-muted">
          <kbd className="kbd">/</kbd> 단어 검색
        </div>
      </aside>

      {/* 상단 탭 (좁은 화면) */}
      {!inSession && (
        <nav className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-line bg-surface/90 px-3 py-2 backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                  isActive ? 'bg-primary-soft text-primary-text' : 'text-ink-2'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
