"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Camera, Upload, X, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layouts/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Photo state
// ---------------------------------------------------------------------------
interface PhotoItem {
  id: string;           // local UUID while uploading; gcs_path after commit
  localUrl: string;     // object URL for preview
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;     // 0–100
}

interface LeadSummary {
  id: string;
  customer_name: string;
  address: string | null;
  description: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Screen 5 / 5b — Photo capture
// ---------------------------------------------------------------------------
export default function PhotosPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const { addToast } = useToast();
  const [lead, setLead] = React.useState<LeadSummary | null>(null);
  const [leadLoading, setLeadLoading] = React.useState(true);
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [context, setContext] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  // Load lead details
  React.useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => { setLead(data); setLeadLoading(false); })
      .catch(() => { setLeadLoading(false); });
  }, [leadId]);

  // ---------------------------------------------------------------------------
  // Photo upload flow
  // ---------------------------------------------------------------------------
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const fileArr = Array.from(files).slice(0, 15 - photos.length);
    if (!fileArr.length) {
      addToast("Maximum 15 photos", "warning");
      return;
    }

    // Optimistic: add photos immediately with local preview (wedge timer starts)
    const newPhotos: PhotoItem[] = fileArr.map((file) => ({
      id: crypto.randomUUID(),
      localUrl: URL.createObjectURL(file),
      file,
      status: "uploading",
      progress: 0,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);

    // Upload each
    for (const photo of newPhotos) {
      uploadPhoto(photo);
    }
  }

  async function uploadPhoto(photo: PhotoItem) {
    try {
      // Step 1: get signed PUT URL from backend
      const initRes = await fetch(`/api/leads/${leadId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1, mime_types: [photo.file.type] }),
      });
      if (!initRes.ok) throw new Error("Failed to get upload URL");
      const initData = await initRes.json();
      const signedUrl: string = initData.signed_urls?.[0];
      const gcsPath: string = initData.gcs_paths?.[0];

      if (!signedUrl || !gcsPath) throw new Error("Invalid upload response");

      // Step 2: PUT to GCS with progress simulation
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, progress: 30 } : p))
      );

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": photo.file.type },
        body: photo.file,
      });
      if (!putRes.ok) throw new Error("GCS upload failed");

      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, progress: 80 } : p))
      );

      // Step 3: commit to backend
      const commitRes = await fetch(`/api/leads/${leadId}/photos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcs_paths: [gcsPath] }),
      });
      if (!commitRes.ok) throw new Error("Failed to commit photo");

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "done", progress: 100, id: gcsPath }
            : p
        )
      );
    } catch {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, status: "error", progress: 0 } : p
        )
      );
      addToast("Failed to upload photo — tap to retry", "error");
    }
  }

  function removePhoto(photoId: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo) URL.revokeObjectURL(photo.localUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  }

  // ---------------------------------------------------------------------------
  // Generate quote
  // ---------------------------------------------------------------------------
  async function generateQuote() {
    const donePhotos = photos.filter((p) => p.status === "done");
    if (!donePhotos.length) {
      addToast("Add at least one photo first", "warning");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to start generation");
      }
      const data = await res.json();
      addToast("AI is generating your quote…", "info");
      // Navigate to generating state screen
      router.push(`/quotes/${data.quote_id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Generation failed", "error");
      setGenerating(false);
    }
  }

  const hasPhotos = photos.length > 0;
  const allDone = photos.every((p) => p.status === "done");
  const canGenerate = hasPhotos && allDone && !generating;

  return (
    <>
      <TopBar
        backHref="/leads"
        backLabel="Back to leads"
        title={lead?.customer_name ?? "Capture Photos"}
      />

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Lead summary card */}
        {leadLoading ? (
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : lead ? (
          <div className="rounded-md border border-slate-200 bg-white p-4">
            {lead.address && (
              <p className="text-sm font-medium text-slate-700">{lead.address}</p>
            )}
            {lead.description && (
              <p className="text-sm text-slate-500 mt-0.5">{lead.description}</p>
            )}
          </div>
        ) : null}

        {/* Section heading */}
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-500" aria-hidden />
          <h2 className="text-sm font-medium text-slate-700">
            Site Photos ({photos.length})
          </h2>
        </div>

        {/* Photo strip */}
        {hasPhotos && (
          <div
            className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory"
            aria-label="Uploaded photos"
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative flex-shrink-0 snap-start"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.localUrl}
                  alt="Site photo"
                  className={cn(
                    "w-20 h-20 object-cover rounded-xl",
                    photo.status === "uploading" && "opacity-50"
                  )}
                />
                {/* Upload progress */}
                {photo.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                    <span className="text-xs text-white font-bold">
                      {photo.progress}%
                    </span>
                  </div>
                )}
                {/* Error */}
                {photo.status === "error" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-red-500/30 rounded-xl"
                    aria-label="Upload failed"
                  >
                    <span className="text-xs text-white">⚠</span>
                  </div>
                )}
                {/* Delete */}
                <button
                  onClick={() => removePhoto(photo.id)}
                  aria-label="Remove photo"
                  className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-slate-800/70 text-white hover:bg-slate-900"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Camera button — PRIMARY CTA */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className={cn(
            "h-12 w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-base",
            "bg-[#F97316] text-white hover:bg-[#EA6A0A] active:bg-[#C2510A]",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2"
          )}
          aria-label="Open camera to take photos"
        >
          <Camera className="h-5 w-5" aria-hidden />
          {hasPhotos ? "Add more photos" : "Take photos"}
        </button>

        {/* Hidden camera input */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          aria-hidden
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Gallery upload */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => galleryInputRef.current?.click()}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Upload from gallery
        </Button>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-hidden
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-slate-200" aria-hidden />
          <span className="text-xs text-slate-400 font-medium">Optional context</span>
          <div className="flex-1 border-t border-slate-200" aria-hidden />
        </div>

        {/* Context note */}
        <Textarea
          placeholder="e.g. Re-roof, colorbond, single-storey, gutters too"
          maxLength={280}
          showCount
          value={context}
          onChange={(e) => setContext(e.target.value)}
          aria-label="Add a brief description for the AI (optional)"
        />

        {!context && hasPhotos && (
          <p className="text-xs text-[#2563EB]" aria-live="polite">
            ℹ No description added — AI will infer from photos only
          </p>
        )}

        {/* Generate button */}
        <Button
          type="button"
          size="lg"
          disabled={!canGenerate}
          loading={generating}
          loadingText="Starting generation..."
          onClick={generateQuote}
          className="gap-2"
          aria-label="Generate AI quote from photos"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          {canGenerate ? "Generate quote →" : "Add photos first"}
        </Button>
      </div>
    </>
  );
}
