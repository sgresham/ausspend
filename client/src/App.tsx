import { Route, Routes } from 'react-router-dom';
import { CoverageProvider } from './coverage';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { BenchmarkPage } from './pages/BenchmarkPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { FunctionsPage } from './pages/FunctionsPage';
import { HomePage } from './pages/HomePage';
import { RegionsPage } from './pages/RegionsPage';
import { SearchPage } from './pages/SearchPage';
import { StatesPage } from './pages/StatesPage';

export function App() {
  return (
    <CoverageProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/functions" element={<FunctionsPage />} />
          <Route path="/functions/:code" element={<FunctionsPage />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/regions/:regionId" element={<RegionsPage />} />
          {/* Contract C aliases: one shared area profile. */}
          <Route path="/region/:regionId" element={<RegionsPage />} />
          <Route path="/areas/:slug" element={<RegionsPage />} />
          <Route path="/states" element={<StatesPage />} />
          <Route path="/states/:code" element={<StatesPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
      </Routes>
    </CoverageProvider>
  );
}
