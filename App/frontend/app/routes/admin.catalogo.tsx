import { useState } from 'react';
import type { MetaFunction } from '@remix-run/node';
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
import type { AdminProductInput, AdminProduct, Category } from '@shared/schemas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Plus, Search, AlertTriangle, Tag, LayoutTemplate, BoxSelect, Package, Trash2, Edit } from 'lucide-react';
import { SortableCatalogGrid } from '~/components/catalog/SortableCatalogGrid';
import { toast } from 'sonner';

export const meta: MetaFunction = () => {
  return [{ title: 'Catálogo | Gyro Store Admin' }];
};

export default function AdminCatalogo() {
  const { data: catalog = [], isLoading, isError } = useGetAdminCatalogQuery();
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

  const [formData, setFormData] = useState<AdminProductInput>({
    name: '',
    price: 0,
    basePrice: 0,
    images: [],
    specs: [],
    published: false,
    isPromo: false,
    sortOrder: 0,
    categoryId: null,
  });

  const [categoryFormData, setCategoryFormData] = useState({ name: '', slug: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '', price: 0, basePrice: 0, images: [], specs: [], published: false, isPromo: false, sortOrder: 0
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: AdminProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      basePrice: product.basePrice || 0,
      images: product.images,
      specs: product.specs,
      published: product.published,
      isPromo: product.isPromo,
      sortOrder: product.sortOrder,
      categoryId: product.categoryId ?? null,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct({ id: editingProduct.id, data: formData }).unwrap();
        toast.success('Producto actualizado.');
      } else {
        await createProduct(formData).unwrap();
        toast.success('Producto creado.');
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.success('Acción simulada (Backend pendiente).');
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      try {
        await deleteProduct(id).unwrap();
        toast.success('Producto eliminado.');
      } catch (error) {
        toast.success('Eliminación simulada (Backend pendiente).');
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
    } catch (error) {
      toast.error('No se pudo guardar el orden (Simulado).');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Gestión de Catálogo</h2>
          <p className="text-muted-foreground">Arrastra productos para reordenar, edítalos, o administra las plantillas.</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-card border border">
            <TabsTrigger value="catalog" className="data-[state=active]:bg-muted"><Package className="w-4 h-4 mr-2" /> Artículos</TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-muted"><Tag className="w-4 h-4 mr-2" /> Categorías</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-muted"><LayoutTemplate className="w-4 h-4 mr-2" /> Templates</TabsTrigger>
            <TabsTrigger value="combos" className="data-[state=active]:bg-muted"><BoxSelect className="w-4 h-4 mr-2" /> Combos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsContent value="catalog" className="space-y-4 outline-none">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar productos..." 
                className="pl-9 bg-card border focus-visible:ring-ring text-foreground w-full"
              />
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={handleOpenCreate} className="font-bold h-10">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>

          <DialogContent className="bg-card border text-foreground w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-xl">
                {editingProduct ? 'Editar Producto' : 'Crear Producto'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Completa los detalles. Estos cambios afectarán el storefront inmediatamente si lo publicas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-6 mt-6 pb-20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">Nombre del Producto</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-card border focus-visible:ring-ring" 
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Categoría</Label>
                  <Select 
                    value={formData.categoryId || ''} 
                    onValueChange={v => setFormData({ ...formData, categoryId: v || null })}
                  >
                    <SelectTrigger className="bg-card border">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border">
                      <SelectItem value="">Sin categoría</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-foreground">Precio Final (C$)</Label>
                    <Input 
                      id="price" type="number" min="0" step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="bg-card border focus-visible:ring-ring" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="basePrice" className="text-foreground text-xs">Precio "Antes" (Tachado)</Label>
                    <Input 
                      id="basePrice" type="number" min="0" step="0.01"
                      value={formData.basePrice}
                      onChange={e => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                      className="bg-card border focus-visible:ring-ring" 
                    />
                  </div>
                </div>

                <div className="space-y-4 border border rounded-lg p-4 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base text-foreground">Publicado</Label>
                      <p className="text-sm text-muted-foreground">¿Visible en la tienda?</p>
                    </div>
                    <Switch 
                      checked={formData.published} 
                      onCheckedChange={(c) => setFormData({ ...formData, published: c })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base text-foreground">Promoción</Label>
                      <p className="text-sm text-muted-foreground">¿Destacar en inicio?</p>
                    </div>
                    <Switch 
                      checked={formData.isPromo} 
                      onCheckedChange={(c) => setFormData({ ...formData, isPromo: c })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6 pt-4 border-t border">
                <Button type="submit" disabled={isCreating || isUpdating} className="w-full">
                  {isCreating || isUpdating ? 'Guardando...' : 'Guardar Producto'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isError ? (
        <Card className="bg-card border-danger/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
             <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
             <p className="text-destructive font-medium">No se pudo cargar el catálogo.</p>
             <p className="text-muted-foreground text-sm">Esperando que el backend conecte con la base de datos.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="bg-card border animate-pulse h-64"></Card>
          ))}
        </div>
      ) : catalog.length === 0 ? (
        <Card className="bg-card border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Tag className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">Catálogo Vacío</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4 text-center max-w-sm">No hay productos registrados. Comienza agregando tu primer artículo.</p>
            <Button onClick={handleOpenCreate}>
              Agregar Producto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <SortableCatalogGrid 
          items={catalog} 
          onReorder={handleReorder}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      )}
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
                    <div key={c.id} className="flex items-center justify-between p-4 bg-card/50 border border rounded-lg">
                      <div>
                        <h4 className="font-medium text-foreground">{c.name}</h4>
                        <p className="text-sm text-muted-foreground">/{c.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setEditingCategoryId(c.id); setCategoryFormData({ name: c.name, slug: c.slug }); }}
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => handleDeleteCategory(c.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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
        <Card className="bg-card border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LayoutTemplate className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">Templates (Próximamente)</h3>
            <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">Aquí podrás administrar las plantillas de PC y componentes.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="combos" className="outline-none">
        <Card className="bg-card border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BoxSelect className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">Combos (Próximamente)</h3>
            <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">Administra ofertas y agrupaciones de productos.</p>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
