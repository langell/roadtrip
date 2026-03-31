import PlanDetail from './plan-detail';

type PlanPageProps = {
  searchParams: Promise<{ draft?: string }>;
};

const PlanPage = async ({ searchParams }: PlanPageProps) => {
  const { draft } = await searchParams;
  return <PlanDetail draftKey={draft ?? null} />;
};

export default PlanPage;
