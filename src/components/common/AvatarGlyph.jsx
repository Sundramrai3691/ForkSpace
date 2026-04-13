import { Brain, BookOpen, Shield, Bug, Zap, Leaf } from 'lucide-react';

const ICONS = {
  'clever-fox': Brain,
  'nerdy-owl': BookOpen,
  'silent-bear': Shield,
  'debug-raccoon': Bug,
  'speedy-cheetah': Zap,
  'calm-tortoise': Leaf,
};

export default function AvatarGlyph({ avatar, className = 'h-4 w-4' }) {
  const Icon = ICONS[avatar?.id] || Brain;
  return <Icon className={className} strokeWidth={2} />;
}
