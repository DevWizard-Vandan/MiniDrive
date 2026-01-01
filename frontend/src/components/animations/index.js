// Animation Components Export
export { default as ParticleBackground } from './ParticleBackground';
export {
    FileCardSkeleton,
    FileGridSkeleton,
    SidebarSkeleton,
    ActivitySkeleton,
    TextSkeleton,
    PageSkeleton
} from './SkeletonLoader';
export { default as GlassCard, GlassButton, GlassPanel } from './GlassCard';
export { default as MorphingLogo } from './MorphingLogo';
export { default as NeumorphicButton, NeumorphicInput, NeumorphicToggle } from './NeumorphicButton';
export { default as LiquidCard, LiquidButton } from './LiquidCard';

// Animation Constants
export const transitions = {
    spring: { type: 'spring', stiffness: 300, damping: 25 },
    smooth: { duration: 0.3, ease: 'easeInOut' },
    bounce: { type: 'spring', stiffness: 500, damping: 15 },
    slow: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
};

export const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};

export const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.05
        }
    }
};

export const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

export const scaleIn = {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 }
};
