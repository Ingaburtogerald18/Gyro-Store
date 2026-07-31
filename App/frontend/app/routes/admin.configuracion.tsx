import { useEffect, useState, useRef } from 'react';
import { getSupabaseClient } from '~/lib/supabase.client';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { ImagePlus, X, Save, UploadCloud } from 'lucide-react';
import type { FinancialConfig, ImageResources } from '@shared/schemas';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border pt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-8">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Card className="bg-card border overflow-hidden p-5">
        <CardContent className="p-0">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function ImagesConfig() {
  const [config, setConfig] = useState<ImageResources>({
    logoStatic: '',
    logoAnimated: '',
    favicon: '',
    posLogo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Track images uploaded in this session to clean them up if discarded
  const uploadedInSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchConfig = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      try {
        const res = await fetch('/api/admin/config/images', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) throw new Error('Error al cargar imágenes');
        const data = await res.json();
        setConfig({
          logoStatic: data.logoStatic || '',
          logoAnimated: data.logoAnimated || '',
          favicon: data.favicon || '',
          posLogo: data.posLogo || ''
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión');

      const res = await fetch('/api/admin/config/images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(config)
      });
      
      if (!res.ok) throw new Error('Error al guardar imágenes');
      const data = await res.json();
      setConfig(data);
      uploadedInSession.current.clear(); // All saved, nothing to clean up
      setSuccessMsg('Recursos guardados correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File, key: keyof ImageResources) => {
    try {
      setSaving(true);
      setError('');
      
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'config'); // Folder in Cloudflare R2

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');

      // If replacing an image that was uploaded *in this session* (not yet saved),
      // delete it from R2 to avoid orphans.
      const prevUrl = config[key];
      if (prevUrl && uploadedInSession.current.has(prevUrl)) {
        fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({ url: prevUrl })
        }).catch(console.error);
        uploadedInSession.current.delete(prevUrl);
      }

      uploadedInSession.current.add(data.url);
      setConfig(prev => ({ ...prev, [key]: data.url }));
    } catch (err: any) {
      setError(err.message || 'Error al subir la imagen');
    } finally {
      setSaving(false);
    }
  };

  const renderUploadBox = (title: string, desc: string, key: keyof ImageResources) => {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border bg-muted p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        {config[key] ? (
          <div className="relative group rounded-lg border border bg-card p-2">
            <div className="aspect-video w-full flex items-center justify-center overflow-hidden rounded-md bg-black/20">
              <img src={config[key]} alt={title} className="max-h-32 max-w-full object-contain" />
            </div>
            <button
              type="button"
              onClick={async () => {
                const url = config[key];
                if (url && uploadedInSession.current.has(url)) {
                  const supabase = getSupabaseClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  fetch('/api/upload', {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
                    },
                    body: JSON.stringify({ url })
                  }).catch(console.error);
                  uploadedInSession.current.delete(url);
                }
                setConfig(p => ({ ...p, [key]: '' }));
              }}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
              title="Eliminar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border bg-card transition-colors hover:border-primary hover:bg-primary/5">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Subir imagen</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file, key);
              }}
            />
          </label>
        )}
        <Input 
          placeholder="O ingresa la URL de la imagen" 
          value={config[key] || ''} 
          onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
        />
      </div>
    );
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Cargando recursos...</div>;

  return (
    <Section 
      title="Recursos de Imágenes" 
      description="Sube los logos y favicons que se utilizarán en la interfaz y en los tickets generados."
    >
      <div className="space-y-6">
        {error && <div className="rounded-md bg-destructive/20 p-3 text-sm text-destructive">{error}</div>}
        {successMsg && <div className="rounded-md bg-primary/20 p-3 text-sm text-primary">{successMsg}</div>}
        
        <div className="grid gap-6 md:grid-cols-2">
          {renderUploadBox("Logo estático", "Cabeceras y web. Recomendado: 512x512px (PNG transparente)", "logoStatic")}
          {renderUploadBox("Logo animado", "Animación principal. Recomendado: 512x512px (WebM/GIF)", "logoAnimated")}
          {renderUploadBox("Favicon", "Ícono de la pestaña. Recomendado: 32x32px o 64x64px (PNG/ICO)", "favicon")}
          {renderUploadBox("Logo del ticket", "Impresoras térmicas. Recomendado: 300x300px o similar (Blanco y Negro puro)", "posLogo")}
        </div>
        
        <div className="flex justify-end pt-2">
          <Button onClick={() => handleSave()} disabled={saving} className="bg-primary text-background hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar Imágenes'}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function FinanzasConfig() {
  const [config, setConfig] = useState<FinancialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      try {
        // Obtenemos la configuración financiera actualizada
        const res = await fetch('/api/admin/config/financial', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) {
          // Fallback para no romper la app de inmediato, intentando con / si falló /financial (por si el backend no reinició)
          const res2 = await fetch('/api/admin/config', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          if (!res2.ok) {
            const text = await res2.text();
            throw new Error(`Error al cargar: ${res2.status} - ${text}`);
          }
          const data = await res2.json();
          setConfig(data);
          return;
        }
        const data = await res.json();
        setConfig(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const sum = Object.values(config.pozos).reduce((a, b) => a + (b || 0), 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(`La suma de los pozos debe ser exactamente 1 (actual: ${sum.toFixed(2)})`);
      }

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión');

      let res = await fetch('/api/admin/config/financial', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(config)
      });

      if (res.status === 404) {
         res = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(config)
         });
      }
      
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          throw new Error(`Datos inválidos: ${data.issues.map((i: any) => i.message).join(', ')}`);
        }
        throw new Error(data.error || 'Error al guardar');
      }
      
      setConfig(data);
      setSuccessMsg('Configuración guardada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center text-muted-foreground">Cargando configuración...</div>;
  if (!config) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-destructive/20 p-3 text-sm text-destructive">{error}</div>}
      {successMsg && <div className="rounded-md bg-primary/20 p-3 text-sm text-primary">{successMsg}</div>}

      <form onSubmit={handleSave} className="space-y-8">
        
        <Section title="Configuración General" description="Parámetros base que aplican a todos los módulos.">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tasa de Cambio (C$ por USD)</Label>
              <Input 
                type="number" step="0.01" 
                value={config.exchangeRate} 
                onChange={e => setConfig({...config, exchangeRate: parseFloat(e.target.value) || 0})} 
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Fondo de la Empresa (Salary %)</Label>
              <Input 
                type="number" step="0.01" 
                value={config.salaryPercentage} 
                onChange={e => setConfig({...config, salaryPercentage: parseFloat(e.target.value) || 0})} 
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">Ejemplo: 0.20 para 20%</p>
            </div>
          </div>
        </Section>

        <Section title="Distribución de Pozos" description="Los porcentajes asignados a cada fondo (deben sumar exactamente 1.00).">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.keys(config.pozos).map(key => (
              <div key={key} className="space-y-2">
                <Label className="capitalize">{key}</Label>
                <Input 
                  type="number" step="0.01"
                  value={(config.pozos as any)[key]}
                  onChange={e => {
                    const newPozos = { ...config.pozos, [key]: parseFloat(e.target.value) || 0 };
                    setConfig({...config, pozos: newPozos as any});
                  }}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Escala de Costo F/U" description="Escala escalonada por costo real (C$).">
          <div className="space-y-2">
            {config.costoFUScale.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Costo Máximo (C$)</Label>
                  <Input 
                    type="number" 
                    value={item.maxCost === null ? '' : item.maxCost} 
                    placeholder="Infinito"
                    onChange={e => {
                      const newScale = [...config.costoFUScale];
                      newScale[i].maxCost = e.target.value ? parseFloat(e.target.value) : null;
                      setConfig({...config, costoFUScale: newScale});
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Costo F/U (C$)</Label>
                  <Input 
                    type="number" 
                    value={item.amount}
                    onChange={e => {
                      const newScale = [...config.costoFUScale];
                      newScale[i].amount = parseFloat(e.target.value) || 0;
                      setConfig({...config, costoFUScale: newScale});
                    }}
                  />
                </div>
                <Button 
                  type="button" variant="outline" size="sm" className="mt-5 text-destructive"
                  onClick={() => {
                    const newScale = config.costoFUScale.filter((_, idx) => idx !== i);
                    setConfig({...config, costoFUScale: newScale});
                  }}
                >
                  X
                </Button>
              </div>
            ))}
            <Button 
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => {
                setConfig({...config, costoFUScale: [...config.costoFUScale, { maxCost: null, amount: 0 }]});
              }}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Escala de Márgenes (PVP)" description="Márgenes de venta sugeridos basados en Coste Final (C$).">
          <div className="space-y-2">
            {config.marginScale.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Coste Máximo (C$)</Label>
                  <Input 
                    type="number" 
                    value={item.maxCost === null ? '' : item.maxCost} 
                    placeholder="Infinito"
                    onChange={e => {
                      const newScale = [...config.marginScale];
                      newScale[i].maxCost = e.target.value ? parseFloat(e.target.value) : null;
                      setConfig({...config, marginScale: newScale});
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Margen (ej. 0.43)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={item.margin}
                    onChange={e => {
                      const newScale = [...config.marginScale];
                      newScale[i].margin = parseFloat(e.target.value) || 0;
                      setConfig({...config, marginScale: newScale});
                    }}
                  />
                </div>
                <Button 
                  type="button" variant="outline" size="sm" className="mt-5 text-destructive"
                  onClick={() => {
                    const newScale = config.marginScale.filter((_, idx) => idx !== i);
                    setConfig({...config, marginScale: newScale});
                  }}
                >
                  X
                </Button>
              </div>
            ))}
            <Button 
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => {
                setConfig({...config, marginScale: [...config.marginScale, { maxCost: null, margin: 0 }]});
              }}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Escala de Comisiones" description="Comisión del vendedor basada en Utilidad Neta (C$).">
          <div className="space-y-2">
            {config.commissionScale.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Utilidad Neta Máxima (C$)</Label>
                  <Input 
                    type="number" 
                    value={item.maxProfit === null ? '' : item.maxProfit} 
                    placeholder="Infinito"
                    onChange={e => {
                      const newScale = [...config.commissionScale];
                      newScale[i].maxProfit = e.target.value ? parseFloat(e.target.value) : null;
                      setConfig({...config, commissionScale: newScale});
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Comisión (ej. 0.40)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={item.margin}
                    onChange={e => {
                      const newScale = [...config.commissionScale];
                      newScale[i].margin = parseFloat(e.target.value) || 0;
                      setConfig({...config, commissionScale: newScale});
                    }}
                  />
                </div>
                <Button 
                  type="button" variant="outline" size="sm" className="mt-5 text-destructive"
                  onClick={() => {
                    const newScale = config.commissionScale.filter((_, idx) => idx !== i);
                    setConfig({...config, commissionScale: newScale});
                  }}
                >
                  X
                </Button>
              </div>
            ))}
            <Button 
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => {
                setConfig({...config, commissionScale: [...config.commissionScale, { maxProfit: null, margin: 0 }]});
              }}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <Section title="Descuentos por Mayoreo" description="Descuentos automáticos en el cotizador por volumen.">
          <div className="space-y-2">
            {config.wholesaleDiscounts.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Cantidad Mínima</Label>
                  <Input 
                    type="number" 
                    value={item.minQty} 
                    onChange={e => {
                      const newScale = [...config.wholesaleDiscounts];
                      newScale[i].minQty = parseInt(e.target.value, 10) || 0;
                      setConfig({...config, wholesaleDiscounts: newScale});
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Descuento (ej. 0.15 para 15%)</Label>
                  <Input 
                    type="number" step="0.001"
                    value={item.discount}
                    onChange={e => {
                      const newScale = [...config.wholesaleDiscounts];
                      newScale[i].discount = parseFloat(e.target.value) || 0;
                      setConfig({...config, wholesaleDiscounts: newScale});
                    }}
                  />
                </div>
                <Button 
                  type="button" variant="outline" size="sm" className="mt-5 text-destructive"
                  onClick={() => {
                    const newScale = config.wholesaleDiscounts.filter((_, idx) => idx !== i);
                    setConfig({...config, wholesaleDiscounts: newScale});
                  }}
                >
                  X
                </Button>
              </div>
            ))}
            <Button 
              type="button" variant="outline" size="sm" className="mt-4"
              onClick={() => {
                setConfig({...config, wholesaleDiscounts: [...config.wholesaleDiscounts, { minQty: 2, discount: 0 }]});
              }}
            >
              Agregar tramo
            </Button>
          </div>
        </Section>

        <div className="sticky bottom-4 mt-8 flex justify-end">
          <Button type="submit" disabled={saving} className="bg-primary text-background shadow-lg hover:bg-primary/90">
            {saving ? 'Guardando...' : 'Guardar Configuración Financiera'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminConfiguracion() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-20 pt-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parámetros del negocio editables desde la UI.</p>
      </div>
      
      <div className="space-y-8">
        <ImagesConfig />
        <FinanzasConfig />
      </div>
    </div>
  );
}
