import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { FunctionsPage } from './pages/FunctionsPage';
import { HomePage } from './pages/HomePage';
import { RegionsPage } from './pages/RegionsPage';
import { SearchPage } from './pages/SearchPage';
import { StatesPage } from './pages/StatesPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/functions" element={<FunctionsPage />} />
        <Route path="/functions/:code" element={<FunctionsPage />} />
        <Route path="/regions" element={<RegionsPage />} />
        <Route path="/regions/:regionId" element={<RegionsPage />} />
        <Route path="/states" element={<StatesPage />} />
        <Route path="/states/:code" element={<StatesPage />} />
        <Route path="/data-sources" element={<DataSourcesPage />} />
      </Route>
    </Routes>
  );
}
