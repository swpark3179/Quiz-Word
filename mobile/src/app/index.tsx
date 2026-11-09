import { Redirect } from 'expo-router';

/** 앱 첫 주소(quizword:///)를 '오늘' 탭으로 보낸다 — 탭 화면은 /today 등에 있어 / 에 맞는 화면이 따로 필요하다 */
export default function Index() {
  return <Redirect href="/today" />;
}
