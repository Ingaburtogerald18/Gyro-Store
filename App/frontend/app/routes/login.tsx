import { useState, useEffect } from "react";
import { useSearchParams, Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn, buildWhatsappUrl } from "~/lib/utils";
import { getSupabaseClient } from "~/lib/supabase.client";
import { useGetConfigQuery } from "~/store/api/configApi";
import { loginSchema, type LoginInput } from "../../../shared/schemas";

export const meta: MetaFunction = () => [
  { title: "Acceso Colaboradores · Gyro Store" },
  { name: "description", content: "Acceso exclusivo para personal de Gyro Store" }
];

const WHATSAPP_NUMBER = "50585944758";

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const { data: config } = useGetConfigQuery();

  const [busy, setBusy] = useState<null | "microsoft">(null);
  const [greeting, setGreeting] = useState<{ text: string; emoji: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => setGreeting(getGreeting()), []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/admin';
        } else {
          setIsLoading(false);
        }
      } catch (e) {
        console.error(e);
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  async function runMicrosoft() {
    setBusy("microsoft");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: 'email openid profile User.Read',
          redirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) throw error;
      
    } catch (err: any) {
      toast.error(err?.message || "No se pudo iniciar sesión con Microsoft.");
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16]" data-skin="store">
        <Loader2 className="w-8 h-8 animate-spin text-[#22d3ee]" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#090d16] font-sans text-white" data-skin="store">
      {/* Background concentric circles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-30">
        <div className="absolute -left-64 -top-64 h-[800px] w-[800px] rounded-full border border-[#22d3ee]/10" />
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full border border-[#22d3ee]/10" />
        <div className="absolute -bottom-64 -right-64 h-[800px] w-[800px] rounded-full border border-[#22d3ee]/10" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full border border-[#22d3ee]/10" />
      </div>

      {/* Top Left Back Button */}
      <div className="absolute left-6 top-6 z-20">
        <Button asChild variant="ghost" className="h-10 rounded-full bg-[#13b8a6]/20 px-4 text-[#2dd4bf] hover:bg-[#13b8a6]/30 hover:text-white transition-colors">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al catálogo
          </Link>
        </Button>
      </div>

      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="flex w-full max-w-[1000px] flex-col overflow-hidden rounded-[20px] bg-[#161925] shadow-2xl lg:flex-row border border-white/5 animate-in fade-in zoom-in-95 duration-500">
          
          {/* Left Column: Actions */}
          <div className="flex w-full flex-col justify-center p-8 sm:p-12 lg:w-[55%]">
            <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
            {greeting && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg">{greeting.emoji}</span> {greeting.text} — ingresa con tu cuenta corporativa
              </p>
            )}

            <div className="mt-10">
              <Button
                variant="outline"
                disabled={busy === "microsoft"}
                onClick={runMicrosoft}
                className="h-14 w-full rounded-xl border-white/10 bg-[#0f111a] text-base font-bold text-white hover:bg-white/5 hover:border-white/20 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {busy !== "microsoft" ? <OutlookIcon className="mr-3 h-6 w-6" /> : <Loader2 className="mr-3 h-6 w-6 animate-spin" />}
                Continuar con Microsoft
              </Button>
              <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
                Acceso exclusivo para colaboradores de Gyro Store.<br/>
                Solo se admiten cuentas autorizadas (@gyrostorenic.com, @hotmail o @outlook).
              </p>
            </div>
          </div>

          {/* Right Column: Graphic */}
          <div className="hidden flex-col bg-[#0f111a] p-12 lg:flex lg:w-[45%] lg:justify-between border-l border-white/5">
            <div className="flex flex-1 items-center justify-center">
              {config?.images?.logoStatic ? (
                <img 
                  src={config.images.logoStatic} 
                  alt="Mascota" 
                  className="max-h-[300px] object-contain drop-shadow-2xl animate-in fade-in zoom-in duration-700" 
                />
              ) : (
                <div className="h-[250px] w-[250px] rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="text-white/20 font-medium">Gyro Store</span>
                </div>
              )}
            </div>
            <div className="mt-8">
              <h2 className="text-3xl font-extrabold text-white">Acceso a Colaboradores</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Accede al centro de administración para la gestión de Gyro Store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Buenos días", emoji: "🌅" };
  if (h < 19) return { text: "Buenas tardes", emoji: "☀️" };
  return { text: "Buenas noches", emoji: "🌙" };
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#0078D4" />
      <path d="M3.2 7.2 12 13l8.8-5.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
