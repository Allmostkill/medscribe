import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Setup from './Setup';
import Dashboard from './Dashboard';
import PersonalAccount from './PersonalAccount';
import { purgeOld } from './services/audioBuffer';

export default function App() {
  // Незавершённые записи старше 7 дней удаляем при любом запуске, а не только
  // при открытии рабочего поля (152-ФЗ).
  useEffect(() => { purgeOld().catch(() => {}); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/profile" element={<PersonalAccount />} />
        {/* Всё неизвестное — на главную. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
