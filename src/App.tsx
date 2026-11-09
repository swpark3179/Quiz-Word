import { Fragment, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { FlashPage, FlashPlay } from './pages/Flash';
import { Home } from './pages/Home';
import { QuizPage, QuizPlay } from './pages/Quiz';
import { ReviewPage, ReviewPlay } from './pages/Review';
import { SettingsPage } from './pages/Settings';
import { WordDetail } from './pages/WordDetail';
import { WordsPage } from './pages/Words';
import { WrongPage } from './pages/Wrong';

/** 진행 화면은 주소가 바뀔 때마다 새로 시작한다 (같은 경로에서 범위만 바꿔 들어와도 이전 세션이 남지 않게) */
function Fresh({ children }: { children: ReactNode }) {
  const location = useLocation();
  // 주소창에서 직접 바꾼 경우 key 가 "default" 로 같을 수 있어 search 도 함께 쓴다
  return <Fragment key={`${location.key}|${location.search}`}>{children}</Fragment>;
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="words" element={<WordsPage />} />
          <Route path="word/:id" element={<WordDetail />} />
          <Route path="flash" element={<FlashPage />} />
          <Route path="flash/play" element={<Fresh><FlashPlay /></Fresh>} />
          <Route path="quiz" element={<QuizPage />} />
          <Route path="quiz/play" element={<Fresh><QuizPlay /></Fresh>} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="review/session" element={<Fresh><ReviewPlay /></Fresh>} />
          <Route path="wrong" element={<WrongPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
