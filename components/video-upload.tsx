'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VideoUploadProps {
  onUploadComplete?: (videoId: string, title: string, duration: number) => void;
  maxSize?: number; // in MB
  className?: string;
}

export function VideoUpload({
  onUploadComplete,
  maxSize = 500,
  className = '',
}: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Only MP4, WebM, OGG, and MOV video files are supported.',
      });
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error('File too large', {
        description: `Maximum file size is ${maxSize}MB.`,
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('language', 'en'); // Default to English

      // Simulate progress (actual progress tracking would require more complex setup)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 5;
        });
      }, 500);

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Upload failed');
      }

      const data = await response.json();
      
      toast.success('Video uploaded successfully!', {
        description: 'Subtitles have been automatically generated.',
      });

      // Call success callback
      if (onUploadComplete) {
        onUploadComplete(data.videoId, data.title, data.duration);
      }

      // Reset state
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleButtonClick = () => {
    if (selectedFile && !isUploading) {
      handleUpload();
    } else if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <Button
          onClick={handleButtonClick}
          disabled={isUploading}
          variant="outline"
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading... {uploadProgress}%
            </>
          ) : selectedFile ? (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload {selectedFile.name}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Choose Video File
            </>
          )}
        </Button>

        {selectedFile && !isUploading && (
          <Button
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
        )}
      </div>

      {isUploading && (
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <div>
          <p>Supported formats: MP4, WebM, OGG, MOV</p>
          <p>Max file size: {maxSize}MB | Max duration: 2 hours</p>
          <p className="mt-1">Subtitles will be automatically generated using AI.</p>
        </div>
      </div>
    </div>
  );
}
