// Punto de entrada del sistema de diseño. Las pantallas importan desde aquí:
//   import { Button, Card, TextField, useFeedback } from '../../../shared/ui';
//
// Átomos
export { default as AppText } from './AppText';
export { default as Button } from './Button';
export { default as IconButton } from './IconButton';
export { default as Card } from './Card';
export { default as TextField } from './TextField';
export { default as Chip } from './Chip';
export { default as ProgressBar } from './ProgressBar';

// Moléculas
export { default as SectionHeader } from './SectionHeader';
export { default as ScreenHeader } from './ScreenHeader';
export { default as StatCard } from './StatCard';
export { default as EmptyState } from './EmptyState';

// Carga
export { default as Spinner } from './loading/Spinner';
export { default as Skeleton, SkeletonCard, SkeletonList } from './loading/Skeleton';

// Feedback
export { default as Dialog } from './feedback/Dialog';
export { default as ConfirmDialog } from './feedback/ConfirmDialog';
export { default as MessageDialog, MESSAGE_PRESETS } from './feedback/MessageDialog';
export { default as BlockingOverlay } from './feedback/BlockingOverlay';
export { FeedbackProvider, useFeedback, useConfirm } from './feedback/FeedbackProvider';

// Movimiento
export { default as FadeInView } from './motion/FadeInView';
export { default as StaggerItem } from './motion/StaggerItem';
export * as animations from './motion/animations';
