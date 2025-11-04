"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { VideoCollection } from "@/lib/types";
import { fetchCollections, createCollection, deleteCollection } from "@/lib/collections-client";

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<VideoCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const data = await fetchCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error("Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionTitle.trim()) return;

    try {
      setIsCreating(true);
      const newCollection = await createCollection({
        title: newCollectionTitle,
        description: newCollectionDescription
      });

      setCollections([newCollection, ...collections]);
      setIsCreateDialogOpen(false);
      setNewCollectionTitle("");
      setNewCollectionDescription("");
      toast.success("Collection created");
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error("Failed to create collection");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await deleteCollection(collectionId);
      setCollections(collections.filter(c => c.id !== collectionId));
      toast.success("Collection deleted");
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error("Failed to delete collection");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Video Collections</h1>
          <p className="text-muted-foreground mt-1">
            Organize your videos into collections
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading collections...</p>
        </div>
      ) : collections.length === 0 ? (
        <Card className="p-12 text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first collection to organize videos
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card
              key={collection.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/collections/${collection.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <Folder className="h-8 w-8 text-primary" />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(collection.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-1">{collection.title}</h3>
              {collection.description && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {collection.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {collection.videoCount} {collection.videoCount === 1 ? 'video' : 'videos'}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Create a collection to organize your videos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
                placeholder="Enter collection title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="Enter collection description (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={!newCollectionTitle.trim() || isCreating}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
