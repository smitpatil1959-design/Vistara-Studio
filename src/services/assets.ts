import { request } from './http';

export interface Asset {
  id: string;
  project_id: string;
  kind: 'scan' | 'upload';
  name: string;
  path: string;
  thumb_path: string | null;
  url: string;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string | null;
  source_page: string | null;
  created_at: string;
}

export function listAssets(projectId: string): Promise<Asset[]> {
  return request<Asset[]>(`/api/assets?projectId=${encodeURIComponent(projectId)}`);
}

export function deleteAsset(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/assets', { method: 'DELETE', body: JSON.stringify({ id }) });
}

export function cropAsset(id: string, crop: { x: number; y: number; w: number; h: number }): Promise<Asset> {
  return request<Asset>('/api/assets', { method: 'PUT', body: JSON.stringify({ id, crop }) });
}

export async function uploadAsset(projectId: string, file: File): Promise<Asset> {
  if (file.size > 6 * 1024 * 1024) throw new Error('Image exceeds 6 MB');
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String((r.result as string).split(',')[1] || ''));
    r.onerror = () => reject(new Error('could not read file'));
    r.readAsDataURL(file);
  });
  return request<Asset>('/api/assets', {
    method: 'POST',
    body: JSON.stringify({ projectId, name: file.name, mime: file.type, dataBase64 }),
  });
}
