import {
  Activity, ArrowRight, BarChart3, Bookmark, Box, CheckCircle2, Circle, Code2, Compass, Cpu, Database,
  FileText, Gauge, Globe, Image, Layers, Lock, Mail, MapPin, MessageSquare, Palette, Play, Plus,
  Rocket, Search, Settings, ShieldCheck, Sparkles, Star, Target, ToggleLeft, Type, Users, Workflow, Zap,
  type LucideIcon,
} from 'lucide-react';

/** Curated deterministic icon vocabulary — unknown names degrade to Circle. */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity, arrowright: ArrowRight, barchart3: BarChart3, bookmark: Bookmark, box: Box,
  checkcircle2: CheckCircle2, code2: Code2, compass: Compass, cpu: Cpu, database: Database,
  filetext: FileText, gauge: Gauge, globe: Globe, image: Image, layers: Layers, lock: Lock,
  mail: Mail, mappin: MapPin, messagesquare: MessageSquare, palette: Palette, play: Play,
  plus: Plus, rocket: Rocket, search: Search, settings: Settings, shieldcheck: ShieldCheck,
  sparkles: Sparkles, star: Star, target: Target, toggleleft: ToggleLeft, type: Type,
  users: Users, workflow: Workflow, zap: Zap,
};

export function resolveIcon(name: string): LucideIcon {
  const key = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ICONS[key] || Circle;
}
