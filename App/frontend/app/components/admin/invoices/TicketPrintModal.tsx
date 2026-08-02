import { useRef } from 'react';
import { AnimatedIcon } from '~/components/ui/animated-icons';
import { PrinterIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { useGetInvoiceTicketQuery } from '~/store/api/invoicesApi';
import { Ticket } from './Ticket';

export function TicketPrintModal({
  invoiceId,
  onClose,
}: {
  invoiceId: string | null;
  onClose: () => void;
}) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const { data: ticket, isLoading, isError } = useGetInvoiceTicketQuery(invoiceId!, {
    skip: !invoiceId,
  });

  const handlePrint = () => {
    if (!ticket) return;
    // Agregamos estilos temporales al documento para aislar el ticket al imprimir
    const style = document.createElement('style');
    style.innerHTML = `
      @page { size: 80mm auto; margin: 0; }
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-ticket, #printable-ticket * {
          visibility: visible;
        }
        #printable-ticket {
          position: absolute;
          left: 0;
          top: 0;
          margin: 0;
          padding: 0;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Le ponemos un ID temporal al contenedor para aislarlo en el CSS de arriba
    if (ticketRef.current) {
      ticketRef.current.id = 'printable-ticket';
    }

    window.print();

    // Limpiamos los estilos e IDs temporales después de que window.print() se resuelve
    document.head.removeChild(style);
    if (ticketRef.current) {
      ticketRef.current.id = '';
    }
  };

  if (isError) {
    toast.error('No se pudo cargar el ticket de la factura.');
    onClose();
    return null;
  }

  return (
    <Dialog open={!!invoiceId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ticket {ticket?.ticketNumber ? `#${ticket.ticketNumber}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Label de vista previa */}
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <AnimatedIcon icon={ViewIcon} size={14} />
            Vista previa
          </div>

          {/* Preview container */}
          <div className="max-h-[55vh] overflow-y-auto rounded-2xl border bg-white shadow-lg custom-scrollbar">
            {isLoading || !ticket ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner className="h-6 w-6 text-muted-foreground" />
              </div>
            ) : (
              <Ticket ref={ticketRef} invoice={ticket} />
            )}
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={!ticket}>
              <AnimatedIcon icon={PrinterIcon} size={16} className="mr-1.5" /> Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
