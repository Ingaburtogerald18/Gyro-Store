import { AnimatedIcon } from "~/components/ui/animated-icons";
import { Add01Icon, DashboardSquare01Icon, Delete02Icon, Edit02Icon, Package01Icon, Search01Icon, SquareIcon, Tag01Icon } from "@hugeicons/core-free-icons";
import { lazy, Suspense, useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { pageTitle } from '~/lib/brand';
import { 
  useGetAdminCatalogQuery, 
  useCreateAdminProductMutation, 
  useUpdateAdminProductMutation, 
  useDeleteAdminProductMutation,
  useReorderAdminCatalogMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '~/store/api/catalogAdminApi';
import type { AdminProductInput, AdminProduct } from '@shared/schemas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { PageHeader } from '~/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { QueryState } from '~/components/ui/QueryState';
import { Skeleton } from '~/components/ui/skeleton';
import { SkeletonCard } from '~/components/ui/skeletons';

import { SortableCatalogGrid } from '~/components/catalog/SortableCatalogGrid';
// Los dos más pesados del catálogo (27 KB y 21 KB) se descargaban al entrar,
// aunque el usuario solo viniera a mirar la grilla.
const ProductEditorDialog = lazy(() =>
  import('~/components/catalog/ProductEditorDialog').then((m) => ({ default: m.ProductEditorDialog })),
);
const TemplatesPanel = lazy(() =>
  import('~/components/catalog/TemplatesPanel').then((m) => ({ default: m.TemplatesPanel })),
);
import { ToneDot } from '~/components/catalog/ToneDot';
import { toast } from 'sonner';

export const meta: MetaFunction = () => {
  return [{ title: pageTitle('Catálogo', { admin: true }) }];
};

export default function AdminCatalogo() {
  const { data: catalog = [], isLoading, isError, refetch } = useGetAdminCatalogQuery();
  const [createProduct, { isLoading: isCreating }] = useCreateAdminProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateAdminProductMutation();
  const [deleteProduct] = useDeleteAdminProductMutation();
  const [reorderCatalog] = useReorderAdminCatalogMutation();
  
  const { data: categories = [] } = useGetCategoriesQuery();
  const [createCategory] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  
  const [activeTab, setActiveTab] = useState("catalog");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [categoryFormData, setCategoryFormData] = useState({ name: '', slug: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: AdminProduct) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleSave = async (input: AdminProductInput) => {
    try {
      if (editingProduct) {
        await updateProduct({ id: editingProduct.id, data: input }).unwrap();
        toast.success('Producto actualizado.');
      } else {
        await createProduct(input).unwrap();
        toast.success('Producto creado.');
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      // Antes esto reportaba éxito ("Acción simulada") aunque el guardado
      // fallara, así que el admin creía haber guardado y no era cierto.
      toast.error(error?.data?.error || 'No se pudo guardar el producto.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      try {
        await deleteProduct(id).unwrap();
        toast.success('Producto eliminado.');
      } catch (error: any) {
        toast.error(error?.data?.error || error?.message || 'No se pudo eliminar el producto. Verifica que no tenga pedidos asociados.');
      }
    }
  };

  const handleReorder = async (newItems: AdminProduct[]) => {
    try {
      const reorderPayload = newItems.map((item, index) => ({
        id: item.id!,
        sortOrder: index,
      }));
      await reorderCatalog({ items: reorderPayload }).unwrap();
      toast.success('Orden actualizado.');
    } catch (error: any) {
      toast.error(error?.data?.error || 'No se pudo guardar el orden.');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await updateCategory({ id: editingCategoryId, ...categoryFormData }).unwrap();
        toast.success('Categoría actualizada.');
      } else {
        await createCategory(categoryFormData).unwrap();
        toast.success('Categoría creada.');
      }
      setCategoryFormData({ name: '', slug: '' });
      setEditingCategoryId(null);
    } catch (error) {
      toast.error('Error al guardar la categoría.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta categoría?')) {
      try {
        await deleteCategory(id).unwrap();
        toast.success('Categoría eliminada.');
      } catch (error) {
        toast.error('Error al eliminar.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tienda"
        title="Gestión de Catálogo"
        description="Arrastra productos para reordenar, edítalos, o administra las plantillas."
        filters={
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-card border">
            <TabsTrigger value="catalog" className="data-[state=active]:bg-muted"><AnimatedIcon icon={Package01Icon} size={16} strokeWidth={2} className="mr-2" /> Artículos</TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-muted"><AnimatedIcon icon={Tag01Icon} size={16} strokeWidth={2} className="mr-2" /> Categorías</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-muted"><AnimatedIcon icon={DashboardSquare01Icon} size={16} strokeWidth={2} className="mr-2" /> Templates</TabsTrigger>
            <TabsTrigger value="combos" className="data-[state=active]:bg-muted"><AnimatedIcon icon={SquareIcon} size={16} strokeWidth={2} className="mr-2" /> Combos</TabsTrigger>
          </TabsList>
        </Tabs>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsContent value="catalog" className="space-y-4 outline-none">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm w-full">
              <AnimatedIcon icon={Search01Icon} size={16} strokeWidth={2} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input 
                placeholder="Buscar productos..." 
                className="pl-9 bg-card border focus-visible:ring-ring text-foreground w-full"
              />
            </div>

            <Button onClick={handleOpenCreate} className="font-bold h-10">
              <AnimatedIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
              Nuevo Producto
            </Button>
      </div>

      <QueryState
        loading={isLoading}
        error={isError}
        empty={catalog.length === 0}
        errorMessage="No se pudo cargar el catálogo."
        onRetry={refetch}
        loadingFallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64 rounded-card" />
            ))}
          </div>
        }
        emptyFallback={
          <Card className="border-dashed bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AnimatedIcon icon={Tag01Icon} size={48} strokeWidth={2} className="text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground">Catálogo vacío</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-4 text-center max-w-sm">No hay productos registrados. Comienza agregando tu primer artículo.</p>
              <Button onClick={handleOpenCreate}>
                <AnimatedIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-2" />
                Agregar producto
              </Button>
            </CardContent>
          </Card>
        }
      >
        <SortableCatalogGrid
          items={catalog}
          onReorder={handleReorder}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      </QueryState>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6 outline-none">
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground">Administrar Categorías</CardTitle>
              <CardDescription className="text-muted-foreground">Crea o edita las categorías del catálogo público.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCategory} className="flex flex-col sm:flex-row gap-4 items-end mb-8">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="catName" className="text-foreground">Nombre</Label>
                  <Input 
                    id="catName" 
                    value={categoryFormData.name}
                    onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    className="bg-card border" 
                    required
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="catSlug" className="text-foreground">Slug (URL)</Label>
                  <Input 
                    id="catSlug" 
                    value={categoryFormData.slug}
                    onChange={e => setCategoryFormData({ ...categoryFormData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    className="bg-card border" 
                    required
                  />
                </div>
                <Button type="submit" className="h-10 w-full sm:w-auto">
                  {editingCategoryId ? 'Actualizar' : 'Agregar'}
                </Button>
                {editingCategoryId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingCategoryId(null); setCategoryFormData({name: '', slug: ''})}} className="h-10">Cancelar</Button>
                )}
              </form>

              <div className="space-y-3">
                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay categorías registradas.</p>
                ) : (
                  categories.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 bg-card/50 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {/* Acá es donde se aprende el color: la lista de
                            categorías es el único lugar que las muestra todas
                            juntas, así que el tono se fija por comparación. */}
                        <ToneDot toneKey={c.id} className="size-2.5" />
                        <div>
                          <h4 className="font-medium text-foreground">{c.name}</h4>
                          <p className="text-sm text-muted-foreground">/{c.slug}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setEditingCategoryId(c.id); setCategoryFormData({ name: c.name, slug: c.slug }); }}
                        >
                          <AnimatedIcon icon={Edit02Icon} size={16} strokeWidth={2} className="text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => handleDeleteCategory(c.id)}
                        >
                          <AnimatedIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 outline-none">
          <Suspense fallback={<SkeletonCard lines={6} />}>
            <TemplatesPanel categories={categories} />
          </Suspense>
        </TabsContent>

      <TabsContent value="combos" className="outline-none">
        <Card className="bg-card border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AnimatedIcon icon={SquareIcon} size={48} strokeWidth={2} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">Combos (Próximamente)</h3>
            <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">Administra ofertas y agrupaciones de productos.</p>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      {/* Solo se monta cuando está abierto: `Suspense` sin nada que renderizar
          no descarga el chunk, así que entrar al catálogo no paga los 27 KB. */}
      {isDialogOpen && (
        <Suspense fallback={null}>
          <ProductEditorDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            product={editingProduct}
            categories={categories}
            isSaving={isCreating || isUpdating}
            onSave={handleSave}
          />
        </Suspense>
      )}
    </div>
  );
}
