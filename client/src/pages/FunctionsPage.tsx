import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '../components/PlaceholderPage';

export function FunctionsPage() {
  const { code } = useParams<{ code?: string }>();

  return (
    <PlaceholderPage
      title="Functions (COFOG)"
      summary={
        code
          ? `Placeholder view for COFOG division ${code}. The division detail page will be built in M1b.`
          : 'Placeholder index of the ten COFOG divisions. Division pages will be built in M1b.'
      }
      provenance="COFOG codes and names are shared constants; no spending amounts are loaded in this build."
      intended="A list of the ten COFOG divisions and, for each, spending by financial year, measure type and jurisdiction with links to its source."
    />
  );
}
