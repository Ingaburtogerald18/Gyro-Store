import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit, Trash2, Image as ImageIcon, Globe, Lock } from 'lucide-react';
import type { AdminProduct } from '@shared/schemas';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

interface SortableCatalogGridProps {
  items: AdminProduct[];
  onReorder: (items: AdminProduct[]) => void;
  onEdit: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
}

export function SortableCatalogGrid({ items: initialItems, onReorder, onEdit, onDelete }: SortableCatalogGridProps) {
  const [items, setItems] = useState<AdminProduct[]>([]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);

    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems); // Update local state for immediate feedback
    onReorder(newItems); // Notify parent to save the new order
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id || '')} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id!)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableCardProps {
  item: AdminProduct;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCard({ item, onEdit, onDelete }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id || '' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-card border overflow-hidden flex flex-col relative ${isDragging ? 'shadow-2xl ring-2 ring-ring' : ''}`}
    >
      <div className="absolute left-2 top-2 z-10 flex gap-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-lg bg-black/60 p-1.5 text-white active:cursor-grabbing hover:bg-black/80 transition-colors"
          aria-label="Reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded-lg bg-black/60 p-1.5 text-white hover:text-primary hover:bg-black/80 transition-colors"
          aria-label="Editar"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded-lg bg-black/60 p-1.5 text-white hover:text-destructive hover:bg-black/80 transition-colors"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="aspect-square bg-card/50 relative flex items-center justify-center text-muted-foreground">
        {item.images && item.images[0] ? (
          <img src={item.images[0]} alt={item.name} className="object-cover w-full h-full" />
        ) : (
          <ImageIcon className="w-12 h-12 opacity-50" />
        )}
        <div className="absolute bottom-2 right-2">
          {item.published ? (
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">
              <Globe className="w-3 h-3 mr-1" /> Público
            </Badge>
          ) : (
            <Badge className="bg-muted/80 text-muted-foreground hover:bg-muted border-none">
              <Lock className="w-3 h-3 mr-1" /> Oculto
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4 flex-1">
        {item.isPromo && (
          <span className="mb-1 block text-xs font-semibold text-primary">Promoción</span>
        )}
        <h3 className="font-semibold text-foreground line-clamp-2" title={item.name}>
          {item.name}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">C$ {item.price}</span>
          {item.basePrice && item.basePrice > item.price && (
            <span className="text-xs text-muted-foreground line-through">C$ {item.basePrice}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
