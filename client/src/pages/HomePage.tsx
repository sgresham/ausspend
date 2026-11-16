import { PlaceholderChart } from '../components/PlaceholderChart';
import { PlaceholderPage } from '../components/PlaceholderPage';

export function HomePage() {
  return (
    <PlaceholderPage
      title="ausspend"
      summary="An explorer for published Australian government spending, organised by function, region and state. This foundation build proves the stack runs; it does not contain spending figures yet."
      provenance="The dataset, its source register and verification status arrive in M1b/M1c. Nothing on this page is a real spending observation."
      intended="A national overview once the verified dataset is loaded: totals by COFOG division, measure type and financial year, each row linked to its source."
    >
      <PlaceholderChart />
    </PlaceholderPage>
  );
}
