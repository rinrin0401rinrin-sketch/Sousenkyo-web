import { Navigate, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './routes/NotFoundPage';
import { ElectionDetailPage } from './routes/ElectionDetailPage';
import { GlossaryPage } from './routes/GlossaryPage';
import { HomePage } from './routes/HomePage';
import { MemberPage } from './routes/MemberPage';
import { PrefecturePage } from './routes/PrefecturePage';
import { SpecialFeaturePage } from './routes/SpecialFeaturePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/live" element={<SpecialFeaturePage pageId="live" />} />
      <Route path="/map" element={<SpecialFeaturePage pageId="map" />} />
      <Route path="/parties" element={<SpecialFeaturePage pageId="parties" />} />
      <Route path="/proportional" element={<SpecialFeaturePage pageId="proportional" />} />
      <Route path="/archive" element={<SpecialFeaturePage pageId="archive" />} />
      <Route path="/glossary" element={<GlossaryPage />} />
      <Route path="/elections/:electionId" element={<ElectionDetailPage />} />
      <Route path="/elections/:electionId/prefectures/:prefectureId" element={<PrefecturePage />} />
      <Route path="/elections/:electionId/members/:memberId" element={<MemberPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
