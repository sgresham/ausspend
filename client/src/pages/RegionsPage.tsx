import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '../components/PlaceholderPage';

export function RegionsPage() {
  const { regionId } = useParams<{ regionId?: string }>();

  return (
    <PlaceholderPage
      title="Regions"
      summary={
        regionId
          ? `Placeholder view for region ${regionId}. Regional spending detail will be built in M1c.`
          : 'Placeholder index of spending regions. Regional pages will be built in M1c.'
      }
      provenance="Region records are not loaded in this foundation build."
      intended="Regions and their constituent states/territories, with spending totals and provenance for every value."
    />
  );
}
