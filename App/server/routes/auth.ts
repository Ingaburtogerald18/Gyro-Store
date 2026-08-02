import { Router } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { invalidateProfileCache, requireAnyRole } from '../middleware/auth.js';
import { uploadFile, optimizeImageBuffer, deleteFileByUrl } from '../services/storage.js';
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
      
      // 4. Calculate hash to prevent duplicates
      const hash = crypto.createHash('sha256').update(optimized.buffer).digest('hex').substring(0, 16);
      
      // 5. Get current profile to check if photo changed.
      // `maybeSingle` y no `single`: si el perfil todavía no existe (primer
      // login, carrera con el middleware que lo crea) esto no debe lanzar.
      let currentAvatarUrl: string | null = null;
      if (req.user?.uid) {
        const { data } = await db.from('profiles').select('avatar_url').eq('id', req.user.uid).maybeSingle();
        currentAvatarUrl = data?.avatar_url || null;
      }

      // If hash matches the current URL, skip upload
      if (currentAvatarUrl && currentAvatarUrl.includes(hash)) {
        res.json({ avatar_url: currentAvatarUrl, changed: false });
        return;
      }

      // 6. Upload to R2 with hash in filename
      const uniqueFilename = `${req.user?.uid}-${hash}${optimized.ext || '.jpg'}`;
      const url = await uploadFile(
        optimized.buffer,
        'avatars',
        uniqueFilename,
        optimized.contentType || originalContentType
      );

      // 7. Delete old photo if it exists and is different
      if (currentAvatarUrl) {
        await deleteFileByUrl(currentAvatarUrl);
      }

      // 8. Update user profile in database.
      // Se invalida la caché de perfil del middleware: sin esto, `/auth/me`
      // seguiría devolviendo la foto vieja hasta 30 s después.
      if (req.user?.uid) {
        await db.from('profiles').update({ avatar_url: url }).eq('id', req.user.uid);
        invalidateProfileCache(req.user.uid);
      }

      res.json({ avatar_url: url, changed: true });
    } catch (err: any) {
      console.error('[SYNC-PHOTO] Error sync:', err);
      res.status(500).json({ error: 'Error al sincronizar la foto' });
    }
  })
);

export default router;
