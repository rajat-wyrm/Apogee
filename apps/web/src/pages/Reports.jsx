import { motion } from 'framer-motion';
import { BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export default function Reports() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="Reports" description="Deep dive into team performance and trends." />

      <Card variant="gradient" padding="lg" className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Detailed analytics</h3>
            <p className="mt-1 max-w-md text-sm text-white/70">Explore trends, productivity and project health with our full analytics suite.</p>
          </div>
          <Button as={Link} to="/app/analytics" className="bg-white !text-brand-700 hover:!bg-white/90" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Open analytics
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="md">
          <h3 className="font-semibold mb-3">Weekly summary</h3>
          <p className="text-sm text-[var(--fg-subtle)]">A snapshot of this week&apos;s activity, productivity and notable changes.</p>
          <Button variant="outline" size="sm" className="mt-4">Generate report</Button>
        </Card>
        <Card padding="md">
          <h3 className="font-semibold mb-3">Custom reports</h3>
          <p className="text-sm text-[var(--fg-subtle)]">Build reports tailored to your team&apos;s KPIs and export to CSV or PDF.</p>
          <Button variant="outline" size="sm" className="mt-4">Create report</Button>
        </Card>
      </div>
    </motion.div>
  );
}
