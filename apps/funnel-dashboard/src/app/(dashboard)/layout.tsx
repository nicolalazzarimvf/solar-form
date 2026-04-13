import { DashboardNav } from '@/components/DashboardNav';

export default function DashboardSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <DashboardNav />
      {children}
    </div>
  );
}
