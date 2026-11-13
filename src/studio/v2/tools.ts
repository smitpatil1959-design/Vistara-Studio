import { PanelsTopLeft, LayoutTemplate, GalleryHorizontal, Type, Image, Shapes, Square, Smile, ChartNoAxesColumn, Palette, Sparkles } from 'lucide-react';
export const TOOLS = [
  { id: 'slides', name: 'Slides', icon: PanelsTopLeft }, { id: 'layouts', name: 'Layouts', icon: LayoutTemplate },
  { id: 'templates', name: 'Templates', icon: GalleryHorizontal }, { id: 'text', name: 'Text', icon: Type },
  { id: 'images', name: 'Images', icon: Image }, { id: 'elements', name: 'Elements', icon: Shapes },
  { id: 'shapes', name: 'Shapes', icon: Square }, { id: 'icons', name: 'Icons', icon: Smile },
  { id: 'charts', name: 'Charts', icon: ChartNoAxesColumn }, { id: 'brand', name: 'Brand Kit', icon: Palette },
  { id: 'assistant', name: 'AI Assistant', icon: Sparkles },
] as const;
export type ToolId = typeof TOOLS[number]['id'];
export const EDITOR_FONTS = ['Inter Tight', 'Inter', 'Instrument Serif', 'Space Grotesk', 'Arial', 'Georgia', 'Segoe UI', 'Trebuchet MS', 'Times New Roman', 'Courier New'];
