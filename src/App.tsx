import { Navigate, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './routes/NotFoundPage';
import { ElectionDetailPage } from './routes/ElectionDetailPage';
import { HomePage } from './routes/HomePage';
import { MemberPage } from './routes/MemberPage';
import { PrefecturePage } from './routes/PrefecturePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/elections/:electionId" element={<ElectionDetailPage />} />
      <Route path="/elections/:electionId/prefectures/:prefectureId" element={<PrefecturePage />} />
      <Route path="/elections/:electionId/members/:memberId" element={<MemberPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
