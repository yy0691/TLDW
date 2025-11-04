"use client";

import { useState, useEffect } from "react";
import { Plus, Check, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { VideoCollection } from "@/lib/types";
import {
  fetchCollections,
  createCollection,
  addVideoToCollection,
} from "@/lib/collections-client";

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string; // The video_analyses.id
  videoTitle?: string;
}

export function AddToCollectionDialog({
  open,
  onOpenChange,
  videoId,
  videoTitle,
}: AddToCollectionDialogProps) {
  const [collections, setCollections] = useState<VideoCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadCollections();
    }
  }, [open]);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const data = await fetchCollections();
      setCollections(data);
    } catch (error) {
      console.error("Error loading collections:", error);
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
        description: newCollectionDescription,
      });

      setCollections([newCollection, ...collections]);
      setNewCollectionTitle("");
      setNewCollectionDescription("");
      setShowCreateForm(false);
      toast.success("Collection created");

      // Auto-add video to new collection
      await handleAddToCollection(newCollection.id);
    } catch (error) {
      console.error("Error creating collection:", error);
      toast.error("Failed to create collection");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      setAddingToCollection(collectionId);
      await addVideoToCollection(collectionId, { videoAnalysisId: videoId });
      
      toast.success("Added to collection");
      
      // Update video count locally
      setCollections(
        collections.map((c) =>
          c.id === collectionId ? { ...c, videoCount: c.videoCount + 1 } : c
        )
      );
      
      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error: any) {
      console.error("Error adding to collection:", error);
      if (error.message?.includes("already in collection")) {
        toast.error("Video is already in this collection");
      } else {
        toast.error("Failed to add to collection");
      }
    } finally {
      setAddingToCollection(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            {videoTitle
              ? `Add "${videoTitle}" to a collection`
              : "Add this video to a collection"}
          </DialogDescription>
        </DialogHeader>

        {showCreateForm ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">Collection Title *</Label>
              <Input
                id="new-title"
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
                placeholder="Enter collection title"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
                disabled={isCreating}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCollectionTitle("");
                  setNewCollectionDescription("");
                }}
                disabled={isCreating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCollection}
                disabled={!newCollectionTitle.trim() || isCreating}
                className="flex-1"
              >
                {isCreating ? "Creating..." : "Create & Add"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 py-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowCreateForm(true)}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Collection
              </Button>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading collections...
                </div>
              ) : collections.length > 0 ? (
                <ScrollArea className="h-[300px] rounded-md border p-2">
                  <div className="space-y-2">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => handleAddToCollection(collection.id)}
                        disabled={addingToCollection !== null}
                        className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-accent hover:border-accent-foreground/20 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Folder className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium mb-0.5">
                            {collection.title}
                          </div>
                          {collection.description && (
                            <div className="text-sm text-muted-foreground line-clamp-2 mb-1">
                              {collection.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {collection.videoCount}{" "}
                            {collection.videoCount === 1 ? "video" : "videos"}
                          </div>
                        </div>
                        {addingToCollection === collection.id && (
                          <Check className="h-5 w-5 text-green-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No collections yet</p>
                  <p className="text-xs">Create your first collection above</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
