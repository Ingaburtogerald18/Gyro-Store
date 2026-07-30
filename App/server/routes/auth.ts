import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAnyRole } from '../middleware/auth.js';
import { uploadFile, optimizeImageBuffer } from '../services/storage.js';
import { db } from '../supabase.js';

const router = Router();

// POST /api/auth/sync-photo
// Obtiene el provider_token del cuerpo, descarga la foto de Microsoft y la sube a R2.
router.post(
  '/sync-photo',
  requireAnyRole,
  asyncHandler(async (req, res) => {
    const { provider_token } = req.body;
    
    if (!provider_token) {
      res.status(400).json({ error: 'Falta provider_token' });
      return;
    }

    try {
      // 1. Fetch photo from Microsoft Graph
      const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          Authorization: `Bearer ${provider_token}`,
        },
      });

      if (!response.ok) {
        console.warn(`[SYNC-PHOTO] Graph API error: ${response.status} ${response.statusText}`);
        res.status(404).json({ error: 'No se encontró foto en Microsoft' });
        return;
      }

      // 2. Read as array buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const originalContentType = response.headers.get('content-type') || 'image/jpeg';
      
      // 3. Optimize image
      const optimized = await optimizeImageBuffer(buffer);
      
      // 4. Upload to R2
      const uniqueFilename = `${req.user?.uid}-${Date.now()}${optimized.ext || '.jpg'}`;
      const url = await uploadFile(
        optimized.buffer,
        'avatars',
        uniqueFilename,
        optimized.contentType || originalContentType
      );

      // 5. Update user profile in database
      if (req.user?.uid) {
        await db.from('profiles').update({ avatar_url: url }).eq('id', req.user.uid);
      }

      res.json({ avatar_url: url });
    } catch (err: any) {
      console.error('[SYNC-PHOTO] Error sync:', err);
      res.status(500).json({ error: 'Error al sincronizar la foto' });
    }
  })
);

export default router;
