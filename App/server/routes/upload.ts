import { Router } from 'express';
import multer from 'multer';
import { uploadFile, optimizeImageBuffer, sanitizePathSegment, deleteFileByUrl } from '../services/storage.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes.'));
    }
    cb(null, true);
  },
});

// POST /api/upload
// Expects multipart/form-data with a file field named "file" and optional "folder"
router.post('/', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se recibió ningún archivo.' });
      return;
    }

    const file = req.file;
    const folder = sanitizePathSegment(req.body.folder || 'misc');
    
    // Default values if no optimization
    let bufferToUpload = file.buffer;
    let contentType = file.mimetype;
    let ext = file.originalname.includes('.') 
      ? '.' + file.originalname.split('.').pop()?.toLowerCase()
      : '';

    // Optimize image if it's an image
    if (file.mimetype.startsWith('image/')) {
      const optimized = await optimizeImageBuffer(file.buffer);
      bufferToUpload = optimized.buffer;
      contentType = optimized.contentType || contentType;
      ext = optimized.ext || ext;
    }

    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

    const url = await uploadFile(bufferToUpload, folder, uniqueFilename, contentType);

    console.log('[UPLOAD] Generated URL:', url);
    console.log('[UPLOAD] process.env.R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL);

    res.json({ url });
  } catch (error: any) {
    if (error.message.includes('Cloudflare R2 no está configurado')) {
      res.status(500).json({ error: 'R2 no está configurado en el backend.' });
      return;
    }
    console.error('Error in /api/upload:', error);
    res.status(500).json({ error: 'Error al subir el archivo.' });
  }
});

// DELETE /api/upload
// Deletes a file from R2 (used to clean up orphaned files before saving)
router.delete('/', requireAdmin, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'Falta la URL.' });
      return;
    }
    
    await deleteFileByUrl(url);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/upload:', error);
    res.status(500).json({ error: 'Error al eliminar el archivo.' });
  }
});

export default router;
