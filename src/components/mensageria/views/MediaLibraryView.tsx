import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Image as ImageIcon, Video, FileText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "../ui-bits";

type MediaAsset = {
  id: string;
  file_name: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  media_type: "IMAGE" | "VIDEO" | "DOCUMENT";
  file_size_bytes: number | null;
  meta_media_id: string | null;
  created_at: string;
};

function mediaTypeFromMime(mime: string): "IMAGE" | "VIDEO" | "DOCUMENT" {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibraryView() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const { data } = await supabase
      .from("media_library")
      .select("*")
      .order("created_at", { ascending: false });
    setAssets((data ?? []) as MediaAsset[]);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Limites da própria Meta: 16MB para imagem/áudio/vídeo, 100MB para documento.
        const maxBytes = file.type.startsWith("video/") ? 16 * 1024 * 1024 : 16 * 1024 * 1024;
        if (mediaTypeFromMime(file.type) !== "DOCUMENT" && file.size > maxBytes) {
          toast.error(`${file.name}: acima de 16MB, a Meta não aceita para imagem/vídeo`);
          continue;
        }

        const path = `${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("campaign-media")
          .upload(path, file, { contentType: file.type });
        if (uploadError) {
          toast.error(`Falha ao enviar ${file.name}`);
          continue;
        }

        // Bucket privado: geramos um link assinado de longa duração para
        // exibir a prévia e para a Meta baixar o arquivo ao gerar o media_id.
        const { data: signedData } = await supabase.storage
          .from("campaign-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (!signedData?.signedUrl) {
          toast.error(`Falha ao gerar link de ${file.name}`);
          continue;
        }
        const { data: userData } = await supabase.auth.getUser();

        await supabase.from("media_library").insert({
          file_name: file.name,
          storage_path: path,
          public_url: signedData.signedUrl,
          mime_type: file.type,
          media_type: mediaTypeFromMime(file.type),
          file_size_bytes: file.size,
          created_by: userData.user?.id ?? null,
        });
      }
      toast.success("Upload concluído");
      await carregar();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover(asset: MediaAsset) {
    await supabase.storage.from("campaign-media").remove([asset.storage_path]);
    await supabase.from("media_library").delete().eq("id", asset.id);
    void carregar();
  }

  return (
    <div>
      <PageHeader
        title="Biblioteca de mídia"
        subtitle="Envie fotos e vídeos uma vez — na campanha, é só selecionar."
        action={
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? "Enviando..." : "Enviar arquivo"}
            </Button>
          </>
        }
      />

      {assets.length === 0 ? (
        <EmptyState message="Nenhum arquivo enviado ainda. Fotos e vídeos aparecem aqui para reuso nas campanhas." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex h-32 items-center justify-center bg-muted">
                {asset.media_type === "IMAGE" ? (
                  <img
                    src={asset.public_url}
                    alt={asset.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : asset.media_type === "VIDEO" ? (
                  <Video className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <div className="truncate text-xs font-medium" title={asset.file_name}>
                  {asset.file_name}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatSize(asset.file_size_bytes)}
                  {asset.meta_media_id ? " · já enviado à Meta" : ""}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-destructive hover:text-destructive"
                  onClick={() => void remover(asset)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
        No primeiro disparo de uma campanha, o arquivo selecionado é enviado uma vez para os
        servidores da Meta (media_id) e reaproveitado nos envios seguintes — sem repetir o upload a
        cada mensagem.
      </div>
    </div>
  );
}
