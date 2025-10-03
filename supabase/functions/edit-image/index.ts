import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNWARE_API_URL = 'https://api.runware.ai/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY não configurada');
    }

    const { model, positivePrompt, inputImage, width, height } = await req.json();

    if (!positivePrompt || !inputImage) {
      throw new Error('Prompt e imagem de entrada são obrigatórios');
    }

    console.log('Editando imagem com Runware:', { model, width, height, promptLength: positivePrompt.length });

    // Primeiro, autentica e depois faz a requisição de image-to-image
    const runwarePayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY,
      },
      {
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt,
        width: width || 1024,
        height: height || 1024,
        model: model || "runware:100@1",
        numberResults: 1,
        outputFormat: "PNG",
        inputImage,
        outputType: "base64",
        includeCost: true,
        // Parâmetros otimizados para edição de imagens
        CFGScale: 7.5, // Maior fidelidade ao prompt
        steps: 30, // Mais steps para melhor qualidade
        scheduler: "DPMSolverMultistep",
        strength: 0.75, // Boa balance entre manter a imagem original e aplicar mudanças
        seedImage: inputImage, // Usa a imagem como seed para maior consistência
      }
    ];

    console.log('Enviando requisição para Runware API...');
    const response = await fetch(RUNWARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runwarePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da Runware API:', errorText);
      throw new Error(`Erro da Runware API: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Resposta da Runware:', JSON.stringify(result).substring(0, 200));

    // Procura pelo resultado da tarefa de imageInference
    const imageResult = result.data?.find((item: any) => item.taskType === 'imageInference');
    
    if (!imageResult) {
      throw new Error('Nenhuma imagem foi gerada pela API');
    }

    // Retorna a imagem em base64
    const imageBase64 = imageResult.imageBase64 || imageResult.imageURL;
    
    if (!imageBase64) {
      throw new Error('API não retornou imagem em formato esperado');
    }

    return new Response(
      JSON.stringify({ 
        image: imageBase64,
        cost: imageResult.cost,
        seed: imageResult.seed,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro ao editar imagem:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao editar imagem',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
