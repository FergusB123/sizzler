// Image storage — Cloudinary unsigned upload (reuses Botanica's account/preset),
// with a base64 fallback on Vercel and local-disk in dev. Identical strategy to
// Botanica's server/services/storage.js so the same env vars work.
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

async function uploadFile(buffer, originalname, mimetype) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (cloudName && uploadPreset) {
    // Minimal unsigned upload: only `file` + `upload_preset`. Cloudinary
    // auto-generates a unique public_id; set any folder/naming in the preset
    // itself. (Passing public_id/folder here can be rejected by unsigned presets.)
    const ext = (mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimetype });
    formData.append('file', blob, `${uuidv4()}.${ext}`);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error(`Cloudinary upload failed: ${await res.text()}`);
    const data = await res.json();
    console.log('[storage] Uploaded to Cloudinary:', data.secure_url);
    return data.secure_url;

  } else if (process.env.VERCEL) {
    console.log('[storage] No cloud storage configured on Vercel — using base64 data URL fallback');
    return `data:${mimetype};base64,${buffer.toString('base64')}`;
  } else {
    console.log('[storage] Saving to local disk');
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${uuidv4()}${path.extname(originalname) || '.jpg'}`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    return `/uploads/${filename}`;
  }
}

async function deleteFile(fileUrl) {
  try {
    if (fileUrl?.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch { /* ignore */ }
}

module.exports = { uploadFile, deleteFile };
