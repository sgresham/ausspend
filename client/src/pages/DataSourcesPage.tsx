import { PlaceholderPage } from '../components/PlaceholderPage';

export function DataSourcesPage() {
  return (
    <PlaceholderPage
      title="Data sources"
      summary="Placeholder register of the published sources that will underpin the spending dataset."
      provenance="The real source register, URLs and verification status arrive with M1b. No source records are loaded yet."
      intended="One row per source with its ID, publisher, URL, licence, retrieval date and verification status, linked from every spending record that uses it."
    />
  );
}
