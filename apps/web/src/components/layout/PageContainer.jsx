import { motion } from 'framer-motion';

export default function PageContainer({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {title && <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{title}</h1>}
      {children}
    </motion.div>
  );
}
