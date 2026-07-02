import { apiClient } from "./client";

/**
 * Phase 4 (audit item 4.1): S3 asset upload helper.
 *
 * Replaces the previous `FileReader.readAsDataURL` base64 flow in the
 * Studio. The flow is:
 *
 *   1. POST /assets/upload-url  →  { asset, uploadUrl, publicUrl }
 *   2. PUT  uploadUrl (presigned) with the raw file bytes
 *   3. PATCH /assets/:id/confirm  →  marks the asset UPLOADED
 *
 * The returned `publicUrl` is a permanent CDN URL (S3 or local MinIO)
 * that can be embedded in customData.imageUrl, saved in DesignVersion
 * layers, or shared publicly.
 */

export interface UploadedAsset {
  id: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
}

export async function uploadImageFile(file: File): Promise<UploadedAsset> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded");
  }

  // Read image dimensions client-side so the asset record has them.
  const { width, height } = await readImageDimensions(file);

  // Step 1: request a presigned upload URL
  const { asset, uploadUrl, publicUrl } = await apiClient.post<{
    asset: { id: string };
    uploadUrl: string;
    publicUrl: string;
  }>("/assets/upload-url", {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    width,
    height,
  });

  // Step 2: PUT the raw file bytes to S3 / MinIO
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
  }

  // Step 3: confirm the upload so the asset becomes publicly readable
  await apiClient.patch(`/assets/${asset.id}/confirm`, {});

  return {
    id: asset.id,
    publicUrl,
    width,
    height,
  };
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions"));
    };
    img.src = url;
  });
}
