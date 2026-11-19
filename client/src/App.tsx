import { Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CoverageProvider } from './coverage';
import { DiscoveryProvider } from './search/DiscoveryProvider';
import { Layout } from './components/Layout';
import { LoadingState } from './components/StatusViews';
import { HomePage } from './pages/HomePage';

// Home, the shell and the providers stay in the initial bundle. Every other
// route is split into its own chunk, so charts/recharts only load with the
// function and region detail routes that render them.
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const BenchmarkPage = lazy(() =>
  import('./pages/BenchmarkPage').then((m) => ({ default: m.BenchmarkPage })),
);
const CoverageLimitationsPage = lazy(() =>
  import('./pages/CoverageLimitationsPage').then((m) => ({ default: m.CoverageLimitationsPage })),
);
const DataSourcesPage = lazy(() =>
  import('./pages/DataSourcesPage').then((m) => ({ default: m.DataSourcesPage })),
);
const FunctionsPage = lazy(() =>
  import('./pages/FunctionsPage').then((m) => ({ default: m.FunctionsPage })),
);
const HowBuiltPage = lazy(() =>
  import('./pages/HowBuiltPage').then((m) => ({ default: m.HowBuiltPage })),
);
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const RegionsPage = lazy(() =>
  import('./pages/RegionsPage').then((m) => ({ default: m.RegionsPage })),
);
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const SocPage = lazy(() => import('./pages/SocPage').then((m) => ({ default: m.SocPage })));
const StatesPage = lazy(() =>
  import('./pages/StatesPage').then((m) => ({ default: m.StatesPage })),
);
const TradePage = lazy(() => import('./pages/TradePage').then((m) => ({ default: m.TradePage })));

/** Keep the shell visible and show a status region while a route chunk loads. */
function Routed({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading page…" />}>{children}</Suspense>;
}

export function App() {
  return (
    <CoverageProvider>
      <DiscoveryProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/search"
              element={
                <Routed>
                  <SearchPage />
                </Routed>
              }
            />
            <Route
              path="/functions"
              element={
                <Routed>
                  <FunctionsPage />
                </Routed>
              }
            />
            <Route
              path="/functions/:code"
              element={
                <Routed>
                  <FunctionsPage />
                </Routed>
              }
            />
            <Route
              path="/regions"
              element={
                <Routed>
                  <RegionsPage />
                </Routed>
              }
            />
            <Route
              path="/regions/:regionId"
              element={
                <Routed>
                  <RegionsPage />
                </Routed>
              }
            />
            {/* Contract C aliases: one shared area profile. */}
            <Route
              path="/region/:regionId"
              element={
                <Routed>
                  <RegionsPage />
                </Routed>
              }
            />
            <Route
              path="/areas/:slug"
              element={
                <Routed>
                  <RegionsPage />
                </Routed>
              }
            />
            <Route
              path="/states"
              element={
                <Routed>
                  <StatesPage />
                </Routed>
              }
            />
            <Route
              path="/states/:code"
              element={
                <Routed>
                  <StatesPage />
                </Routed>
              }
            />
            <Route
              path="/trade"
              element={
                <Routed>
                  <TradePage />
                </Routed>
              }
            />
            <Route
              path="/benchmark"
              element={
                <Routed>
                  <BenchmarkPage />
                </Routed>
              }
            />
            <Route
              path="/soc"
              element={
                <Routed>
                  <SocPage />
                </Routed>
              }
            />
            <Route
              path="/data-sources"
              element={
                <Routed>
                  <DataSourcesPage />
                </Routed>
              }
            />
            <Route
              path="/coverage-limitations"
              element={
                <Routed>
                  <CoverageLimitationsPage />
                </Routed>
              }
            />
            <Route
              path="/legal"
              element={
                <Routed>
                  <LegalPage />
                </Routed>
              }
            />
            <Route
              path="/about"
              element={
                <Routed>
                  <AboutPage />
                </Routed>
              }
            />
            <Route
              path="/how-it-was-built"
              element={
                <Routed>
                  <HowBuiltPage />
                </Routed>
              }
            />
          </Route>
        </Routes>
      </DiscoveryProvider>
    </CoverageProvider>
  );
}
