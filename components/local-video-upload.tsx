"use client";

import { useState, useRef } from "react";
import { Upload, X, FileVideo, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocalVideoUploadProps {
  onUploadComplete: (videoId: string, transcript: any[]) => void;
}

export function LocalVideoUpload({ onUploadComplete }: LocalVideoUploadProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid video format. Supported: MP4, WebM, OGG, MOV');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Video file too large. Maximum size: 500MB');
      return;
    }

    setVideoFile(file);
    setError("");

    // Auto-fill title if empty
    if (!title) {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(fileName);
    }
  };

  const handleSubtitleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file format
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'srt' && ext !== 'vtt') {
      setError('Invalid subtitle format. Supported: SRT, VTT');
      return;
    }

    setSubtitleFile(file);
    setError("");
  };

  const getVideoDuration = (): Promise<number> => {
    return new Promise((resolve) => {
      if (!videoFile || !videoRef.current) {
        resolve(0);
        return;
      }

      const video = videoRef.current;
      const url = URL.createObjectURL(videoFile);
      
      video.src = url;
      video.onloadedmetadata = () => {
        const duration = Math.floor(video.duration);
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
    });
  };

  const handleUpload = async () => {
    if (!videoFile || !title.trim()) {
      setError('Please provide video and title');
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Get video duration
      const duration = await getVideoDuration();
      setUploadProgress(10);

      // If subtitle file is provided, use the old flow
      if (subtitleFile) {
        // Upload video
        const videoFormData = new FormData();
        videoFormData.append('video', videoFile);
        videoFormData.append('title', title.trim());
        videoFormData.append('author', author.trim() || 'Local Upload');
        videoFormData.append('duration', duration.toString());

        const videoResponse = await fetch('/api/local/upload-video', {
          method: 'POST',
          body: videoFormData
        });

        if (!videoResponse.ok) {
          const errorData = await videoResponse.json();
          throw new Error(errorData.error || 'Failed to upload video');
        }

        const videoData = await videoResponse.json();
        setUploadProgress(60);

        // Upload subtitle
        const subtitleFormData = new FormData();
        subtitleFormData.append('subtitle', subtitleFile);
        subtitleFormData.append('videoId', videoData.videoId);

        const subtitleResponse = await fetch('/api/local/upload-subtitle', {
          method: 'POST',
          body: subtitleFormData
        });

        if (!subtitleResponse.ok) {
          const errorData = await subtitleResponse.json();
          throw new Error(errorData.error || 'Failed to process subtitle');
        }

        const subtitleData = await subtitleResponse.json();
        setUploadProgress(100);

        // Call completion handler
        onUploadComplete(videoData.videoId, subtitleData.transcript);
      } else {
        // No subtitle file - use automatic recognition
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('language', 'en');

        const response = await fetch('/api/upload-video', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to process video');
        }

        const data = await response.json();
        setUploadProgress(100);

        // Call completion handler
        onUploadComplete(data.videoId, data.transcript);
      }

      // Reset form
      setVideoFile(null);
      setSubtitleFile(null);
      setTitle("");
      setAuthor("");
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-[615px] p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upload Local Video</h3>

        {/* Video upload */}
        <div className="space-y-2">
          <Label htmlFor="video-upload">Video File *</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
            >
              <FileVideo className="h-4 w-4 mr-2" />
              {videoFile ? videoFile.name : 'Select Video'}
            </Button>
            {videoFile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setVideoFile(null)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            onChange={handleVideoSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground">
            Supported: MP4, WebM, OGG, MOV (max 500MB)
          </p>
        </div>

        {/* Subtitle upload */}
        <div className="space-y-2">
          <Label htmlFor="subtitle-upload">Subtitle File (Optional)</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => subtitleInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              {subtitleFile ? subtitleFile.name : 'Select Subtitle'}
            </Button>
            {subtitleFile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSubtitleFile(null)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".srt,.vtt"
            onChange={handleSubtitleSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground">
            Supported: SRT, VTT. If not provided, subtitles will be auto-generated using AI.
          </p>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Video Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title"
            disabled={isUploading}
          />
        </div>

        {/* Author */}
        <div className="space-y-2">
          <Label htmlFor="author">Author (optional)</Label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Enter author name"
            disabled={isUploading}
          />
        </div>

        {/* Upload button */}
        <Button
          onClick={handleUpload}
          disabled={!videoFile || !title.trim() || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading... {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Analyze
            </>
          )}
        </Button>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Hidden video element for duration detection */}
        <video ref={videoRef} className="hidden" />
      </div>
    </Card>
  );
}
