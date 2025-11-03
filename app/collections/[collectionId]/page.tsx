"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration, formatTopicDuration } from "@/lib/utils";
import type { CollectionWithVideos } from "@/lib/types";

interface CollectionPageProps {
  params: Promise<{ collectionId: string }>;
}

export default function CollectionPage({ params }: CollectionPageProps) {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionWithVideos | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [collectionId, setCollectionId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setCollectionId(p.collectionId);
      fetchCollection(p.collectionId);
    });
  }, [params]);

  const fetchCollection = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/collections/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }

      const data = await response.json();
      setCollection(data);
    } catch (error) {
      console.error('Error fetching collection:', error);
      router.push('/collections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    if (!confirm('Remove this video from the collection?')) return;

    try {
      const response = await fetch(`/api/collections/${collectionId}/videos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAnalysisId: videoId })
      });

      if (!response.ok) {
        throw new Error('Failed to remove video');
      }

      // Refresh collection
      await fetchCollection(collectionId);
    } catch (error) {
      console.error('Error removing video:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <p className="text-center text-muted-foreground">Loading collection...</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <p className="text-center text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/collections')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Collections
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{collection.title}</h1>
        {collection.description && (
          <p className="text-muted-foreground">{collection.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {collection.videos.length} {collection.videos.length === 1 ? 'video' : 'videos'}
        </p>
      </div>

      {collection.videos.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
          <p className="text-muted-foreground">
            Add videos to this collection from the analyze page
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {collection.videos.map((video, index) => (
            <Card
              key={video.videoId}
              className="p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative shrink-0">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-40 h-24 object-cover rounded"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full opacity-80 hover:opacity-100"
                      onClick={() => router.push(`/analyze/${video.videoId}`)}
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold text-lg line-clamp-1">
                          {video.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {video.author}
                      </p>
                      {video.duration && (
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatTopicDuration(video.duration)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveVideo(video.videoId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
