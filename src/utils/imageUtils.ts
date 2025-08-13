/**
 * /utils/imageUtils.ts
 *
 * Funções de utilidade para manipular imagens geradas (Download, Compartilhar, Recriar).
 */

// Interface que define a estrutura de um objeto de imagem gerada.
// Essencial para a tipagem correta das funções.
export interface GeneratedImage {
  id: string;
  prompt: string;
  originalPrompt: string;
  detailedPrompt?: string;
  url: string;
  timestamp: string;
  quality: string;
  width: number;
  height: number;
  model: string;
}

// Definição de tipo para uma função de notificação (toast).
// Permite que as funções sejam independentes da implementação específica do toast.
type ToastFunction = (options: {
  title: string;
  description?: string;
  variant: "default" | "destructive";
}) => void;

/**
 * Inicia o download de uma imagem gerada para o dispositivo do usuário.
 * Cria um nome de arquivo a partir do prompt e usa a API Fetch para obter a imagem como um blob.
 *
 * @param image O objeto da imagem a ser baixada.
 * @param toast A função para exibir notificações de sucesso ou erro.
 */
export const downloadImage = (image: GeneratedImage, toast: ToastFunction): void => {
  const fileName = `${image.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .substring(0, 30)}_${Date.now()}.png`;

  fetch(image.url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Falha na rede: ${response.statusText}`);
      }
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Download iniciado", description: `A imagem "${fileName}" está a ser baixada.`, variant: "default" });
    })
    .catch((error) => {
        console.error("Erro no download da imagem:", error);
        toast({ title: "Erro de Download", description: "Não foi possível baixar a imagem.", variant: "destructive" });
    });
};

/**
 * Compartilha uma imagem usando a API Web Share nativa do navegador, se disponível.
 * Caso contrário, copia a URL da imagem para a área de transferência como um fallback.
 *
 * @param image O objeto da imagem a ser compartilhada.
 * @param toast A função para exibir notificações.
 */
export const shareImage = async (image: GeneratedImage, toast: ToastFunction): Promise<void> => {
  const shareData = {
    title: "Imagem Gerada por IA",
    text: image.prompt,
    url: image.url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(image.url);
      toast({
        title: "URL Copiada",
        description: "O link da imagem foi copiado para a área de transferência.",
        variant: "default",
      });
    }
  } catch (error) {
    console.error("Erro ao compartilhar:", error);
    toast({ title: "Erro ao Partilhar", description: "Ocorreu um problema ao tentar partilhar a imagem.", variant: "destructive" });
  }
};

/**
 * Extrai os dados essenciais de um objeto de imagem para preparar uma nova geração.
 * Esta é uma função pura que não causa efeitos colaterais.
 *
 * @param image O objeto de imagem existente.
 * @returns Um objeto contendo o prompt, modelo e qualidade prontos para serem usados
 * para definir o estado em um componente React.
 */
export const getRecreationImageData = (image: GeneratedImage): { prompt: string; model: string; quality: string } => {
  return {
    prompt: image.prompt,
    model: image.model,
    quality: image.quality,
  };
};