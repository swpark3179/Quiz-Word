import { BookOpenText, Brain, Home, Keyboard, Layers, ListChecks, Monitor, Moon, NotebookPen, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { WORDS } from '../data/words';
import { isDue } from '../lib/srs';
import { useProgress } from '../store/progress';
import { isModalOpen, isTyping } from './Dialog';
import { ShortcutHelp } from './ShortcutHelp';

/** short: 좁은 화면 하단 탭에 쓰는 짧은 이름 · hotkey: G 다음에 누르는 글자 */
const NAV = [
  { to: '/', label: '홈', short: '홈', hotkey: 'h', icon: Home, end: true },
  { to: '/words', label: '단어장', short: '단어장', hotkey: 'w', icon: BookOpenText },
  { to: '/flash', label: '플래시카드', short: '카드', hotkey: 'f', icon: Layers },
  { to: '/quiz', label: '객관식', short: '객관식', hotkey: 'q', icon: ListChecks },
  { to: '/review', label: '복습', short: '복습', hotkey: 'r', icon: Brain, badge: 'due' as const },
  { to: '/wrong', label: '오답노트', short: '오답', hotkey: 'o', icon: NotebookPen, badge: 'wrong' as const },
  { to: '/settings', label: '설정', short: '설정', hotkey: 's', icon: SettingsIcon },
];

const THEMES = [
  ['system', '시스템 설정에 맞춤', Monitor],
  ['light', '밝게', Sun],
  ['dark', '어둡게', Moon],
] as const;

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

/** 브라우저 탭 제목 — 단어 상세는 그 화면이 직접 정한다 */
function pageTitle(pathname: string): string | undefined {
  if (pathname.startsWith('/word/')) return undefined;
  if (pathname.startsWith('/review/session')) return '복습 중 · Quiz Word';
  if (pathname.startsWith('/flash/play')) return '플래시카드 진행 중 · Quiz Word';
  if (pathname.startsWith('/quiz/play')) return '객관식 진행 중 · Quiz Word';
  const item = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return item && !item.end ? `${item.label} · Quiz Word` : 'Quiz Word';
}

export function Layout() {
  useTheme();
  const badges = useBadges();
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const theme = useProgress((s) => s.settings.theme);
  const updateSettings = useProgress((s) => s.updateSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  const inSession = /^\/(flash|quiz|review)\/(play|session)/.test(location.pathname);
  /** G 를 누른 시각 — 바로 이어서 누른 글자만 화면 이동으로 본다 */
  const goPrefixAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || isModalOpen()) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      // 학습 중에는 실수로 화면을 벗어나지 않게 이동 단축키를 받지 않는다
      if (inSession) return;
      if (e.key === '/') {
        e.preventDefault();
        navigate('/words?focus=1');
        return;
      }
      const key = e.key.toLowerCase();
      const armed = Date.now() - goPrefixAt.current < 1500;
      goPrefixAt.current = 0;
      if (armed) {
        const target = NAV.find((n) => n.hotkey === key);
        if (target) {
          e.preventDefault();
          navigate(target.to);
        }
      } else if (key === 'g') {
        goPrefixAt.current = Date.now();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, inSession]);

  // 다른 화면으로 넘어가면 맨 위에서 시작한다 (뒤로 가기는 브라우저가 위치를 되돌린다)
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const title = pageTitle(location.pathname);
    if (title) document.title = title;
  }, [location.pathname]);

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
        <nav aria-label="주 메뉴" className="flex-1 space-y-0.5 overflow-y-auto px-3">
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
        <div className="space-y-3 px-4 pb-5 pt-3">
          <div role="group" aria-label="테마" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {THEMES.map(([value, name, Icon]) => (
              <button
                key={value}
                onClick={() => updateSettings({ theme: value })}
                title={`테마: ${name}`}
                aria-label={`테마: ${name}`}
                aria-pressed={theme === value}
                className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition ${
                  theme === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-2 text-[11.5px] text-muted">
            <span>
              <kbd className="kbd">/</kbd> 단어 검색
            </span>
            <button onClick={() => setHelpOpen(true)} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:text-ink">
              <Keyboard size={14} /> 단축키 <kbd className="kbd">?</kbd>
            </button>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 sm:px-8 md:py-10">
        <Outlet />
      </main>

      {/* 하단 탭 (좁은 화면) — 학습 중에는 숨겨 화면을 넓게 쓴다 */}
      {!inSession && (
        <nav
          aria-label="주 메뉴"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {NAV.map(({ to, short, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `focus-inset relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <span className="relative">
                <Icon size={20} strokeWidth={2} />
                {badge && badges[badge] > 0 && (
                  <span
                    className={`absolute -right-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[9.5px] font-bold leading-4 ${
                      badge === 'due' ? 'bg-primary text-white dark:text-[#0e1018]' : 'bg-danger text-white dark:text-[#0e1018]'
                    }`}
                  >
                    {badges[badge] > 99 ? '99+' : badges[badge]}
                  </span>
                )}
              </span>
              <span className="truncate">{short}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
