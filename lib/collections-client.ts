import { csrfFetch } from '@/lib/csrf-client';
import { VideoCollection, CollectionWithVideos } from '@/lib/types';

interface CreateCollectionPayload {
  title: string;
  description?: string;
  thumbnail?: string;
}

interface UpdateCollectionPayload {
  title?: string;
  description?: string;
  thumbnail?: string;
}

interface AddVideoPayload {
  videoAnalysisId: string;
}

export async function fetchCollections(): Promise<VideoCollection[]> {
  const response = await csrfFetch.get('/api/collections');

  if (!response.ok) {
    throw new Error('Failed to fetch collections');
  }

  const data = await response.json();
  return (data.collections || []) as VideoCollection[];
}

export async function fetchCollection(collectionId: string): Promise<CollectionWithVideos> {
  const response = await csrfFetch.get(`/api/collections/${collectionId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch collection');
  }

  const data = await response.json();
  return data as CollectionWithVideos;
}

export async function createCollection(payload: CreateCollectionPayload): Promise<VideoCollection> {
  const response = await csrfFetch.post('/api/collections', payload);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to create collection');
  }

  const data = await response.json();
  return data.collection as VideoCollection;
}

export async function updateCollection(
  collectionId: string,
  payload: UpdateCollectionPayload
): Promise<VideoCollection> {
  const response = await csrfFetch.patch(`/api/collections/${collectionId}`, payload);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to update collection');
  }

  const data = await response.json();
  return data.collection as VideoCollection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const response = await csrfFetch.delete('/api/collections', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to delete collection');
  }
}

export async function addVideoToCollection(
  collectionId: string,
  payload: AddVideoPayload
): Promise<void> {
  const response = await csrfFetch.post(`/api/collections/${collectionId}/videos`, payload);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to add video to collection');
  }
}

export async function removeVideoFromCollection(
  collectionId: string,
  videoAnalysisId: string
): Promise<void> {
  const response = await csrfFetch.delete(`/api/collections/${collectionId}/videos`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoAnalysisId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to remove video from collection');
  }
}
