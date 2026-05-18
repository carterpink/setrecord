import { type Variants } from 'framer-motion';

// --dur-state 220ms → 0.22s  |  ease: --ease-snappy cubic-bezier(0.32, 0.72, 0.12, 1)
const SNAPPY = [0.32, 0.72, 0.12, 1] as const;

/** Opacity 0 → 1. Matches --dur-state (220ms). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: SNAPPY },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: SNAPPY },
  },
};

/** Opacity + scale 0.96 → 1. Matches --dur-modal (400ms). */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: SNAPPY },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.25, ease: SNAPPY },
  },
};

/** Opacity + y 8 → 0. Matches --dur-state (220ms). */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: SNAPPY },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.15, ease: SNAPPY },
  },
};

/**
 * Container variant with staggered children.
 * @param childDelay - seconds between each child (default 0.05 = 50ms)
 */
export const stagger = (childDelay = 0.05): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: childDelay },
  },
  exit: {},
});

const SMOOTH = [0.25, 0.46, 0.45, 0.94] as const;

/** Modal backdrop fade. 250ms ease-smooth in, 200ms out. */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25, ease: SMOOTH },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: SMOOTH },
  },
};

/** Modal panel: opacity + scale 0.96→1 + y 8→0. 400ms in, 250ms out. */
export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: SNAPPY },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.25, ease: SNAPPY },
  },
};

export { motion, AnimatePresence } from 'framer-motion';
