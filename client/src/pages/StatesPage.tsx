import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '../components/PlaceholderPage';

export function StatesPage() {
  const { code } = useParams<{ code?: string }>();

  return (
    <PlaceholderPage
      title="States and territories"
      summary={
        code
          ? `Placeholder view for state/territory ${code}. Subdivision pages will be built in M1c.`
          : 'Placeholder index of Australian states and territories. Subdivision pages will be built in M1c.'
      }
      provenance="No subdivision records or spending values are loaded in this build."
      intended="Each state and territory, its region, and spending by function and measure with source references."
    />
  );
}
