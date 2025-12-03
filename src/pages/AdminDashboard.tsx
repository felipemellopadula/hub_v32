import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminStatsCards } from "@/components/AdminStatsCards";
import { AdminAlerts } from "@/components/AdminAlerts";
import { StorageCleanup } from "@/components/StorageCleanup";
import { OpenAIPricingTable } from "@/components/OpenAIPricingTable";
import { GrokPricingTable } from "@/components/GrokPricingTable";
import { DeepSeekPricingTable } from "@/components/DeepSeekPricingTable";
import UnifiedPricingTable from "@/components/UnifiedPricingTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Shield, AlertTriangle, RefreshCw, ChevronDown, Download, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface TokenUsage {
  id: string;
  user_id: string;
  tokens_used: number;
  model_name: string;
  message_content: string | null;
  ai_response_content?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  created_at: string;
}

interface AdminStats {
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalUsers: number;
  totalTokens: number;
}

interface UserReport {
  user_id: string;
  email: string;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalTokens: number;
  transactionCount: number;
}

// OpenAI pricing per million tokens (USD) - Updated from user's table
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.1": { input: 1.25, output: 10.0 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1": { input: 3.0, output: 12.0 },
  "gpt-4.1-mini": { input: 0.8, output: 3.2 },
  "gpt-4.1-mini-2025-04-14": { input: 0.8, output: 3.2 },
  "gpt-4.1-nano": { input: 0.2, output: 0.8 },
  "o4-mini": { input: 4.0, output: 16.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  synergyai: { input: 0.15, output: 0.6 }, // Same as gpt-4o-mini
  "gpt-4o": { input: 5.0, output: 15.0 },
  "gpt-4": { input: 30.0, output: 60.0 },
  "gpt-3.5-turbo": { input: 3.0, output: 6.0 },
  "whisper-1": { input: 0.006, output: 0 }, // $0.006 per minute
};

// Gemini pricing per token (USD) - Based on official Google pricing (corrected 2025-10-14)
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3-pro": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 }, // US$ 3.0/15.0 per million (média dos tiers)
  "gemini-2.5-pro": { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 }, // US$ 1.25/10.0 per million
  "gemini-2.5-flash": { input: 2.50 / 1_000_000, output: 15.0 / 1_000_000 }, // US$ 2.50/15.0 per million
  "gemini-2.5-flash-lite": { input: 0.31 / 1_000_000, output: 2.5 / 1_000_000 }, // US$ 0.31/2.5 per million
};

// Grok (xAI) pricing per million tokens (USD) - Official xAI pricing (updated 2025-11-26)
const GROK_PRICING: Record<string, { input: number; output: number }> = {
  "grok-4-1-fast-reasoning": { input: 0.20, output: 0.50 }, // US$ 0.20/0.50 per million
  "grok-4-1-fast-non-reasoning": { input: 0.20, output: 0.50 }, // US$ 0.20/0.50 per million
  "grok-4": { input: 3.0, output: 15.0 },
  "grok-4-0709": { input: 3.0, output: 15.0 }, // Same as grok-4
  "grok-3": { input: 3.0, output: 15.0 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "grok-beta": { input: 3.0, output: 15.0 }, // Fallback for beta versions
};

// DeepSeek pricing per million tokens (USD) - Official DeepSeek pricing
const DEEPSEEK_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.56, output: 1.68 },
  "deepseek-reasoner": { input: 0.56, output: 1.68 },
  "deepseek-v3.1": { input: 0.56, output: 1.68 }, // Generic fallback
  deepseek: { input: 0.56, output: 1.68 }, // Generic fallback
};

// Image models pricing per image (USD)
const IMAGE_PRICING: Record<string, { cost: number }> = {
  "gpt-image-1": { cost: 0.167 },
  "gemini-flash-image": { cost: 0.039 },
  "qwen-image": { cost: 0.0058 },
  "ideogram-3.0": { cost: 0.06 },
  "flux.1-kontext-max": { cost: 0.08 },
  "seedream-4.0": { cost: 0.03 },
  "nano-banana-2-pro": { cost: 0.134 }, // Google Nano Banana 2 Pro
  "google:4@2": { cost: 0.134 }, // Google Nano Banana 2 Pro (alias)
};

// Video models pricing per video (USD)
const VIDEO_PRICING: Record<string, { cost: number }> = {
  "bytedance:1@1": { cost: 0.162 }, // ByteDance Seedance 1.0 Lite
  "bytedance": { cost: 0.162 }, // Fallback genérico
  "klingai:5@3": { cost: 0.90 }, // KlingAI V2.1 Master
  "google:veo-3@fast": { cost: 0.90 }, // Google Veo3 Fast
};
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  // Latest models
  "claude-opus-4-1-20250805": { input: 15.0, output: 30.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 6.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },

  // Legacy models with exact version numbers
  "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },

  // Generic model name matching (fallbacks)
  "claude-opus-4.1": { input: 15.0, output: 30.0 },
  "claude-opus-4": { input: 15.0, output: 30.0 },
  "claude-sonnet-4": { input: 3.0, output: 6.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-haiku-4": { input: 1.0, output: 5.0 },
  "claude-3-5-haiku": { input: 0.8, output: 4.0 },
  "claude-haiku-3.5": { input: 0.8, output: 4.0 },
  "claude-3-opus": { input: 15.0, output: 75.0 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAdminAuth();
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalUsers: 0,
    totalTokens: 0,
  });
  const [recentUsage, setRecentUsage] = useState<TokenUsage[]>([]);
  const [allUsageData, setAllUsageData] = useState<TokenUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<
    "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" | "todos"
  >("todos");
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "year" | "all">("all");
  const [userReports, setUserReports] = useState<UserReport[]>([]);

  // Function to calculate cost for a single usage record (for alerts)
  const calculateSingleCost = useCallback((usage: TokenUsage): number => {
    const isImageModel =
      Object.keys(IMAGE_PRICING).some((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
      usage.model_name === "google:4@1";
    const isVideoModel = Object.keys(VIDEO_PRICING).some((key) =>
      usage.model_name.toLowerCase().includes(key.toLowerCase()),
    );

    if (isVideoModel) {
      const videoModelKey =
        Object.keys(VIDEO_PRICING).find((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
        "bytedance:1@1";
      return VIDEO_PRICING[videoModelKey].cost;
    }

    if (isImageModel) {
      const imageModelKey =
        Object.keys(IMAGE_PRICING).find((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
        "gpt-image-1";
      return IMAGE_PRICING[imageModelKey]?.cost || 0.02;
    }

    let inputTokens: number;
    let outputTokens: number;

    if (usage.input_tokens !== null && usage.output_tokens !== null) {
      inputTokens = usage.input_tokens;
      outputTokens = usage.output_tokens;
    } else {
      const inputCharacters = usage.message_content?.length || 0;
      inputTokens = charsToTokens(inputCharacters);
      outputTokens = Math.floor(inputTokens * 2.5);
    }

    const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
    const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
    const isGrokModel = usage.model_name.toLowerCase().includes("grok");
    const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
    let provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" = "openai";

    if (isGeminiModel) provider = "gemini";
    else if (isClaudeModel) provider = "claude";
    else if (isGrokModel) provider = "grok";
    else if (isDeepSeekModel) provider = "deepseek";

    const inputCost = inputTokens * getCostPerToken(usage.model_name, "input", provider);
    const outputCost = outputTokens * getCostPerToken(usage.model_name, "output", provider);
    return inputCost + outputCost;
  }, []);

  const getDateFilterRange = (period: "today" | "week" | "month" | "year" | "all") => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "today":
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        };
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return {
          start: weekStart,
          end: now,
        };
      case "month":
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 1);
        return {
          start: monthStart,
          end: now,
        };
      case "year":
        const yearStart = new Date(today);
        yearStart.setFullYear(today.getFullYear() - 1);
        return {
          start: yearStart,
          end: now,
        };
      case "all":
      default:
        return null;
    }
  };

  const charsToTokens = (chars: number): number => Math.ceil(chars / 4);

  const getCostPerToken = (
    model: string,
    type: "input" | "output",
    provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" | "todos" = selectedProvider,
  ): number => {
    let modelKey = model.toLowerCase();

    // Handle SynergyAI mapping
    if (modelKey === "synergyai") {
      modelKey = "gpt-4o-mini";
      provider = "openai";
    }

    if (provider === "gemini") {
      // Check if it's a Gemini model
      const isGeminiModel =
        modelKey.includes("gemini") ||
        Object.keys(GEMINI_PRICING).some(
          (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
        );

      if (isGeminiModel) {
        console.log(`🔍 DEBUG GEMINI - Model: ${model}, Provider: ${provider}`);
        console.log(`🔍 ModelKey: ${modelKey}`);
        console.log(`🔍 Available Gemini keys:`, Object.keys(GEMINI_PRICING));
        
        const matchedKey =
          Object.keys(GEMINI_PRICING).find(
            (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
          ) || "gemini-2.5-flash"; // ✅ CORRIGIDO: fallback agora aponta para modelo existente

        console.log(`✅ Matched key: ${matchedKey}`);
        
        // ✅ VALIDAÇÃO: Garantir que a key existe no GEMINI_PRICING
        if (!GEMINI_PRICING[matchedKey]) {
          console.error(`❌ ERRO: Modelo Gemini não encontrado no GEMINI_PRICING: ${model}`);
          console.error(`Matched key tentada: ${matchedKey}`);
          console.error(`Keys disponíveis:`, Object.keys(GEMINI_PRICING));
          return 0; // Retornar 0 explicitamente ao invés de undefined
        }

        const cost = GEMINI_PRICING[matchedKey][type]; // Already converted to unit price
        console.log(`✅ Gemini ${type} cost for ${model}: $${cost} per token`);
        return cost;
      }
    }

    if (provider === "grok") {
      // Check if it's a Grok model
      const isGrokModel =
        modelKey.includes("grok") ||
        Object.keys(GROK_PRICING).some(
          (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
        );

      if (isGrokModel) {
        // Sort keys by length (descending) to match more specific names first
        const sortedKeys = Object.keys(GROK_PRICING).sort((a, b) => b.length - a.length);
        const matchedKey =
          sortedKeys.find((key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)) ||
          "grok-3";

        const costPerMillion = GROK_PRICING[matchedKey][type];
        const costPerToken = costPerMillion / 1000000; // Convert per million to unit price
        console.log(`Grok ${type} cost for ${model}: ${costPerMillion} per million = ${costPerToken} per token`);
        return costPerToken;
      }
    }

    if (provider === "deepseek") {
      // Check if it's a DeepSeek model
      const isDeepSeekModel =
        modelKey.includes("deepseek") ||
        Object.keys(DEEPSEEK_PRICING).some(
          (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
        );

      if (isDeepSeekModel) {
        // Sort keys by length (descending) to match more specific names first
        const sortedKeys = Object.keys(DEEPSEEK_PRICING).sort((a, b) => b.length - a.length);
        const matchedKey =
          sortedKeys.find((key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)) ||
          "deepseek-chat";

        const costPerMillion = DEEPSEEK_PRICING[matchedKey][type];
        const costPerToken = costPerMillion / 1000000; // Convert per million to unit price
        console.log(`DeepSeek ${type} cost for ${model}: ${costPerMillion} per million = ${costPerToken} per token`);
        return costPerToken;
      }
    }

    if (provider === "claude") {
      // Check if it's a Claude model
      const isClaudeModel =
        modelKey.includes("claude") ||
        Object.keys(CLAUDE_PRICING).some(
          (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
        );

      if (isClaudeModel) {
        const matchedKey =
          Object.keys(CLAUDE_PRICING).find(
            (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
          ) || "claude-haiku-4-5";

        // Convert from per million tokens to per individual token: $X per 1M tokens = $X / 1,000,000 per token
        const pricePerMillion = CLAUDE_PRICING[matchedKey][type];
        const costPerToken = pricePerMillion / 1_000_000;
        console.log(`Claude ${type} cost for ${model}: ${pricePerMillion} per million = ${costPerToken} per token`);
        return costPerToken;
      }
    }

    // Default to OpenAI pricing (convert from per million to unit price)
    const matchedKey =
      Object.keys(OPENAI_PRICING).find(
        (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
      ) || "gpt-4o-mini";

    const cost = OPENAI_PRICING[matchedKey][type] / 1_000_000;
    console.log(`OpenAI ${type} cost for ${model}:`, cost);
    return cost;
  };

  const calculateAdminStats = (
    data: TokenUsage[],
    providerFilter: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" | "todos" = "todos",
    period: "today" | "week" | "month" | "year" | "all" = "all",
  ): AdminStats => {
    console.log('========== ADMIN STATS CALCULATION ==========');
    console.log(`Total registros no banco: ${data.length}`);
    console.log(`Registros com input_tokens válidos: ${data.filter(d => d.input_tokens !== null).length}`);
    console.log(`Registros SEM input_tokens (antigos): ${data.filter(d => d.input_tokens === null).length}`);
    console.log(`Provider selecionado: ${providerFilter}`);
    console.log(`Período selecionado: ${period}`);
    console.log('============================================');
    console.log("Calculating stats for provider:", providerFilter, "period:", period);
    console.log("Total records:", data.length);

    let filteredData = data;

    // Filter data based on selected period
    const dateRange = getDateFilterRange(period);
    if (dateRange) {
      filteredData = filteredData.filter((usage) => {
        const usageDate = new Date(usage.created_at);
        return usageDate >= dateRange.start && usageDate <= dateRange.end;
      });
      console.log("After date filter:", filteredData.length, "records");
    }

    // Filter data based on selected provider
    if (providerFilter !== "todos") {
      filteredData = filteredData.filter((usage) => {
        const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
        const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
        const isGrokModel = usage.model_name.toLowerCase().includes("grok");
        const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
        const isImageModel = Object.keys(IMAGE_PRICING).some((key) =>
          usage.model_name.toLowerCase().includes(key.toLowerCase()),
        );

        if (providerFilter === "gemini") return isGeminiModel;
        if (providerFilter === "claude") return isClaudeModel;
        if (providerFilter === "grok") return isGrokModel;
        if (providerFilter === "deepseek") return isDeepSeekModel;
        if (providerFilter === "image") return isImageModel;
        return !isGeminiModel && !isClaudeModel && !isGrokModel && !isDeepSeekModel && !isImageModel; // OpenAI models
      });
    }

    console.log("Filtered records:", filteredData.length);

    // For debugging Claude, let's see what models we have
    if (providerFilter === "claude") {
      const claudeModels = filteredData.map((d) => d.model_name);
      console.log("Claude models in data:", [...new Set(claudeModels)]);
      console.log("Calculating total cost for ALL Claude transactions");
    }

    let totalCost = 0;
    let totalRevenue = 0;
    let totalTokens = 0;
    const uniqueUsers = new Set<string>();
    let claudeTransactionCount = 0;
    let processedCount = 0;
    let skippedCount = 0;
    let fallbackCount = 0;

    filteredData.forEach((usage) => {
      // Use real token data if available, otherwise skip old records with inflated values
      let inputTokens: number;
      let outputTokens: number;

      if (usage.input_tokens !== null && usage.output_tokens !== null) {
        // Use real data from database (new system)
        processedCount++;
        inputTokens = usage.input_tokens;
        outputTokens = usage.output_tokens;

        // Detect provider based on model name
        const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
        const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
        const isGrokModel = usage.model_name.toLowerCase().includes("grok");
        const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
        const isImageModel =
          Object.keys(IMAGE_PRICING).some((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
          usage.model_name === "google:4@1"; // Detectar registros antigos do Gemini
        const isVideoModel =
          Object.keys(VIDEO_PRICING).some((key) => usage.model_name.toLowerCase().includes(key.toLowerCase()));
        let provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" = "openai";

        // Debug log for image model detection
        if (
          usage.model_name.toLowerCase().includes("gemini") ||
          usage.model_name.toLowerCase().includes("qwen") ||
          usage.model_name.toLowerCase().includes("image")
        ) {
          console.log(`🔍 Debugging model: ${usage.model_name}`);
          console.log(`🖼️ Is image model: ${isImageModel}`);
          console.log(`📋 IMAGE_PRICING keys:`, Object.keys(IMAGE_PRICING));
          console.log(
            `🎯 Key matches:`,
            Object.keys(IMAGE_PRICING).map(
              (key) => `${key} -> ${usage.model_name.toLowerCase().includes(key.toLowerCase())}`,
            ),
          );
        }

        // CRITICAL: Check video and image models FIRST before text models
        if (isVideoModel) provider = "video";
        else if (isImageModel) provider = "image";
        else if (isGeminiModel) provider = "gemini";
        else if (isClaudeModel) provider = "claude";
        else if (isGrokModel) provider = "grok";
        else if (isDeepSeekModel) provider = "deepseek";

        // Debug log for provider assignment
        if (
          usage.model_name.toLowerCase().includes("gemini") ||
          usage.model_name.toLowerCase().includes("qwen") ||
          usage.model_name.toLowerCase().includes("image")
        ) {
          console.log(`🏷️ Assigned provider: ${provider}`);
        }

        // Calculate costs using correct pricing per token type
        let totalCostForTransaction: number;
        let inputCost = 0;
        let outputCost = 0;

        if (provider === "video") {
          // For video models, use fixed cost per video
          const videoModelKey = Object.keys(VIDEO_PRICING).find((key) =>
            usage.model_name.toLowerCase().includes(key.toLowerCase()),
          );

          if (videoModelKey) {
            totalCostForTransaction = VIDEO_PRICING[videoModelKey].cost;
          } else {
            // Fallback para modelos desconhecidos
            totalCostForTransaction = VIDEO_PRICING["bytedance"]?.cost || 0.162;
          }

          console.log(`🎬 Video model detected: ${usage.model_name}`);
          console.log(`🔍 Matched video key: ${videoModelKey || "bytedance (fallback)"}`);
          console.log(`💰 Video cost: $${totalCostForTransaction}`);
        } else if (provider === "image") {
          // For image models, use fixed cost per image
          const imageModelKey = Object.keys(IMAGE_PRICING).find((key) =>
            usage.model_name.toLowerCase().includes(key.toLowerCase()),
          );

          if (imageModelKey) {
            totalCostForTransaction = IMAGE_PRICING[imageModelKey].cost;
          } else if (usage.model_name === "google:4@1") {
            // Registros antigos do Gemini Flash Image antes do mapeamento
            totalCostForTransaction = 0.039;
          } else {
            // Fallback para modelos desconhecidos
            totalCostForTransaction = IMAGE_PRICING["gpt-image-1"]?.cost || 0.02;
          }

          // Debug log for image cost calculation
          console.log(`🖼️ Image model detected: ${usage.model_name}`);
          console.log(`🔍 Matched image key: ${imageModelKey || "google:4@1 (old)"}`);
          console.log(`💰 Image cost: $${totalCostForTransaction}`);
          console.log(`🔢 Raw cost value:`, totalCostForTransaction);
          console.log(`📊 Available IMAGE_PRICING keys:`, Object.keys(IMAGE_PRICING));
          console.log(`🎯 typeof totalCostForTransaction:`, typeof totalCostForTransaction);
          console.log(`🎯 isNaN(totalCostForTransaction):`, isNaN(totalCostForTransaction));
          console.log(`🎯 totalCostForTransaction === 0:`, totalCostForTransaction === 0);
        } else {
          inputCost = inputTokens * getCostPerToken(usage.model_name, "input", provider);
          outputCost = outputTokens * getCostPerToken(usage.model_name, "output", provider);
          totalCostForTransaction = inputCost + outputCost;
        }

        // Debug log for final calculation
        if (usage.model_name.toLowerCase().includes("qwen") || usage.model_name.toLowerCase().includes("image")) {
          console.log(`🏁 Final totalCostForTransaction: ${totalCostForTransaction}`);
          console.log(`🏁 Final inputCost: ${inputCost}`);
          console.log(`🏁 Final outputCost: ${outputCost}`);
        }

        // Total tokens used (input + output)
        const totalTokensForTransaction = inputTokens + outputTokens;

        // Revenue calculation: 200% profit margin = custo * 3 (custo + 200% de lucro)
        const revenue = totalCostForTransaction * 3;

        // Debug for selected provider
        if (provider === "claude") {
          claudeTransactionCount++;

          // Show detailed breakdown for first 3 transactions and any expensive ones
          const showDetails = claudeTransactionCount <= 3 || totalCostForTransaction > 0.01;

          if (showDetails) {
            console.log(`\n=== CLAUDE TRANSACTION ${claudeTransactionCount} ===`);
            console.log(`Model: ${usage.model_name}`);
            console.log(`Input tokens (real data): ${inputTokens}`);
            console.log(`Output tokens (real data): ${outputTokens}`);
            console.log(`Has AI response data: ${usage.ai_response_content ? "Yes" : "No"}`);
            console.log(`Input cost per token: $${getCostPerToken(usage.model_name, "input", provider).toFixed(10)}`);
            console.log(`Output cost per token: $${getCostPerToken(usage.model_name, "output", provider).toFixed(10)}`);
            console.log(`Input cost total: $${inputCost.toFixed(10)}`);
            console.log(`Output cost total: $${outputCost.toFixed(10)}`);
            console.log(`Total transaction cost: $${totalCostForTransaction.toFixed(10)}`);
            console.log(`Running total so far: $${(totalCost + totalCostForTransaction).toFixed(10)}`);

            // Show expensive transactions
            if (totalCostForTransaction > 0.01) {
              console.log(`⚠️  HIGH COST TRANSACTION DETECTED!`);
            }
            console.log(`===================================\n`);
          }
        }

        totalCost += totalCostForTransaction;
        totalRevenue += revenue;
        totalTokens += totalTokensForTransaction;

        // Debug log for aggregation
        if (usage.model_name.toLowerCase().includes("qwen") || usage.model_name.toLowerCase().includes("image")) {
          console.log(`📈 Adding to totalCost: ${totalCostForTransaction} (running total: ${totalCost})`);
          console.log(`📈 Revenue for this transaction: ${revenue}`);
          console.log(`📈 Current totalCost after this transaction: ${totalCost}`);
        }

        if (usage.user_id) {
          uniqueUsers.add(usage.user_id);
        }
      } else if (usage.tokens_used && usage.tokens_used > 0) {
        // FALLBACK: Para registros antigos sem input_tokens/output_tokens
        fallbackCount++;
        // Estimar: 70% input, 30% output (proporção comum)
        const totalTokensUsed = usage.tokens_used;
        inputTokens = Math.floor(totalTokensUsed * 0.7);
        outputTokens = Math.floor(totalTokensUsed * 0.3);
        
        console.log(`⚠️ Registro antigo detectado (ID: ${usage.id})`);
        console.log(`📊 tokens_used: ${totalTokensUsed} -> Estimando ${inputTokens} input + ${outputTokens} output`);
        
        // Detectar provider igual ao código existente
        const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
        const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
        const isGrokModel = usage.model_name.toLowerCase().includes("grok");
        const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
        const isImageModel = Object.keys(IMAGE_PRICING).some((key) =>
          usage.model_name.toLowerCase().includes(key.toLowerCase())
        );
        const isVideoModel = Object.keys(VIDEO_PRICING).some((key) =>
          usage.model_name.toLowerCase().includes(key.toLowerCase())
        );
        
        let provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" = "openai";
        
        if (isVideoModel) provider = "video";
        else if (isImageModel) provider = "image";
        else if (isGeminiModel) provider = "gemini";
        else if (isClaudeModel) provider = "claude";
        else if (isGrokModel) provider = "grok";
        else if (isDeepSeekModel) provider = "deepseek";
        
        // Calcular custo
        let totalCostForTransaction: number;
        
        if (provider === "video") {
          const videoModelKey = Object.keys(VIDEO_PRICING).find((key) =>
            usage.model_name.toLowerCase().includes(key.toLowerCase())
          );
          totalCostForTransaction = videoModelKey ? VIDEO_PRICING[videoModelKey].cost : 0.162;
        } else if (provider === "image") {
          const imageModelKey = Object.keys(IMAGE_PRICING).find((key) =>
            usage.model_name.toLowerCase().includes(key.toLowerCase())
          );
          totalCostForTransaction = imageModelKey ? IMAGE_PRICING[imageModelKey].cost : 0.039;
        } else {
          const inputCost = inputTokens * getCostPerToken(usage.model_name, "input", provider);
          const outputCost = outputTokens * getCostPerToken(usage.model_name, "output", provider);
          totalCostForTransaction = inputCost + outputCost;
        }
        
        console.log(`💰 Custo estimado: $${totalCostForTransaction.toFixed(6)}`);
        
        totalCost += totalCostForTransaction;
        totalRevenue += totalCostForTransaction * 3; // 200% profit margin
        totalTokens += totalTokensUsed;
        
        if (usage.user_id) {
          uniqueUsers.add(usage.user_id);
        }
      } else {
        // Registro inválido (sem tokens)
        skippedCount++;
        console.warn(`⚠️ Registro ignorado - sem dados de tokens (ID: ${usage.id})`);
      }
    });

    console.log('\n========== RESUMO DO PROCESSAMENTO ==========');
    console.log(`✅ Registros processados (com input/output tokens): ${processedCount}`);
    console.log(`🔄 Registros com fallback (apenas tokens_used): ${fallbackCount}`);
    console.log(`❌ Registros ignorados (sem tokens): ${skippedCount}`);
    console.log(`💰 Custo Total: $${totalCost.toFixed(4)}`);
    console.log(`💵 Receita Total: $${totalRevenue.toFixed(4)}`);
    console.log(`📊 Tokens Totais: ${totalTokens.toLocaleString()}`);
    console.log(`👥 Usuários Únicos: ${uniqueUsers.size}`);
    console.log('============================================\n');

    // Detailed analysis for selected provider
    if (providerFilter === "claude") {
      console.log(`\n🔍 CLAUDE DETAILED ANALYSIS:`);
      console.log(`Total Claude transactions: ${claudeTransactionCount}`);
      console.log(`Total Claude cost: $${totalCost.toFixed(6)}`);
      console.log(
        `Average cost per transaction: $${claudeTransactionCount > 0 ? (totalCost / claudeTransactionCount).toFixed(6) : "0"}`,
      );

      // Analyze input vs output token ratios and costs
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalInputCost = 0;
      let totalOutputCost = 0;

      const expensiveTransactions = filteredData
        .filter((usage) => {
          const modelKey = usage.model_name.toLowerCase();
          return (
            modelKey.includes("claude") ||
            Object.keys(CLAUDE_PRICING).some(
              (key) => modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey),
            )
          );
        })
        .map((usage) => {
          const inputCharacters = usage.message_content?.length || 0;
          const inputTokens = charsToTokens(inputCharacters);
          const outputTokens = Math.ceil(inputTokens * 0.5); // Current estimate

          const inputCostPerToken = getCostPerToken(usage.model_name, "input", "claude");
          const outputCostPerToken = getCostPerToken(usage.model_name, "output", "claude");

          const inputCost = inputTokens * inputCostPerToken;
          const outputCost = outputTokens * outputCostPerToken;
          const totalCost = inputCost + outputCost;

          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
          totalInputCost += inputCost;
          totalOutputCost += outputCost;

          return {
            model: usage.model_name,
            messageLength: inputCharacters,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            totalCost,
            date: usage.created_at,
          };
        })
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      console.log(`\n📊 TOKEN BREAKDOWN:`);
      console.log(`Total input tokens: ${totalInputTokens.toLocaleString()}`);
      console.log(`Total output tokens: ${totalOutputTokens.toLocaleString()} (estimated)`);
      console.log(`Input cost: $${totalInputCost.toFixed(6)}`);
      console.log(`Output cost: $${totalOutputCost.toFixed(6)}`);
      console.log(
        `Ratio output/input: ${totalInputTokens > 0 ? (totalOutputTokens / totalInputTokens).toFixed(2) : "0"}x`,
      );

      console.log(`\n💰 Top 5 most expensive Claude transactions:`);
      expensiveTransactions.forEach((tx, i) => {
        console.log(
          `${i + 1}. ${tx.model} - Total: $${tx.totalCost.toFixed(6)} | Input: $${tx.inputCost.toFixed(6)} (${tx.inputTokens} tokens) | Output: $${tx.outputCost.toFixed(6)} (${tx.outputTokens} tokens) | ${tx.messageLength} chars`,
        );
      });
    } else if (providerFilter === "grok") {
      console.log(`\n🔍 GROK DETAILED ANALYSIS:`);
      console.log(`Total Grok transactions: ${filteredData.length}`);
      console.log(`Total Grok cost: $${totalCost.toFixed(6)}`);
      console.log(
        `Average cost per transaction: $${filteredData.length > 0 ? (totalCost / filteredData.length).toFixed(6) : "0"}`,
      );

      const grokModels = [...new Set(filteredData.map((d) => d.model_name))];
      console.log(`Grok models in data:`, grokModels);
    } else if (providerFilter === "deepseek") {
      console.log(`\n🔍 DEEPSEEK DETAILED ANALYSIS:`);
      console.log(`Total DeepSeek transactions: ${filteredData.length}`);
      console.log(`Total DeepSeek cost: $${totalCost.toFixed(6)}`);
      console.log(
        `Average cost per transaction: $${filteredData.length > 0 ? (totalCost / filteredData.length).toFixed(6) : "0"}`,
      );

      const deepSeekModels = [...new Set(filteredData.map((d) => d.model_name))];
      console.log(`DeepSeek models in data:`, deepSeekModels);
    }

    console.log("Final calculated totals:", {
      totalCost: totalCost.toFixed(8),
      totalRevenue: totalRevenue.toFixed(8),
      totalProfit: (totalRevenue - totalCost).toFixed(8),
      totalUsers: uniqueUsers.size,
      totalTokens,
    });

    // Special debug for image costs
    const imageRecords = filteredData.filter((usage) =>
      Object.keys(IMAGE_PRICING).some((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())),
    );
    console.log(`🖼️ Final image records processed: ${imageRecords.length}`);
    console.log(
      `🖼️ Image record models:`,
      imageRecords.map((r) => r.model_name),
    );

    if (imageRecords.length > 0) {
      let imageOnlyTotalCost = 0;
      imageRecords.forEach((usage) => {
        const imageModelKey =
          Object.keys(IMAGE_PRICING).find((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
          "gpt-image-1";
        const cost = IMAGE_PRICING[imageModelKey].cost;
        imageOnlyTotalCost += cost;
        console.log(`🖼️ Image ${usage.model_name} -> key: ${imageModelKey} -> cost: $${cost}`);
      });
      console.log(`🖼️ Total image cost should be: $${imageOnlyTotalCost.toFixed(8)}`);
    }

    return {
      totalCost,
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
      totalUsers: uniqueUsers.size,
      totalTokens,
    };
  };

  const calculateUserReports = (
    data: TokenUsage[],
    providerFilter: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" | "todos" = "todos",
    period: "today" | "week" | "month" | "year" | "all" = "all",
  ): UserReport[] => {
    let filteredData = data;

    // Filter by period
    const dateRange = getDateFilterRange(period);
    if (dateRange) {
      filteredData = filteredData.filter((usage) => {
        const usageDate = new Date(usage.created_at);
        return usageDate >= dateRange.start && usageDate <= dateRange.end;
      });
    }

    // Filter by provider
    if (providerFilter !== "todos") {
      filteredData = filteredData.filter((usage) => {
        const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
        const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
        const isGrokModel = usage.model_name.toLowerCase().includes("grok");
        const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
        const isImageModel = Object.keys(IMAGE_PRICING).some((key) =>
          usage.model_name.toLowerCase().includes(key.toLowerCase()),
        );

        if (providerFilter === "gemini") return isGeminiModel;
        if (providerFilter === "claude") return isClaudeModel;
        if (providerFilter === "grok") return isGrokModel;
        if (providerFilter === "deepseek") return isDeepSeekModel;
        if (providerFilter === "image") return isImageModel;
        return !isGeminiModel && !isClaudeModel && !isGrokModel && !isDeepSeekModel && !isImageModel;
      });
    }

    // Group by user
    const userMap = new Map<string, UserReport>();

    filteredData.forEach((usage) => {
      if (!usage.user_id) return;

      let inputTokens: number;
      let outputTokens: number;
      let cost = 0;

      const isImageModel =
        Object.keys(IMAGE_PRICING).some((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
        usage.model_name === "google:4@1";
      const isVideoModel = Object.keys(VIDEO_PRICING).some((key) =>
        usage.model_name.toLowerCase().includes(key.toLowerCase()),
      );

      if (isVideoModel) {
        const videoModelKey =
          Object.keys(VIDEO_PRICING).find((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
          "bytedance:1@1";
        cost = VIDEO_PRICING[videoModelKey].cost;
        inputTokens = 1;
        outputTokens = 1;
      } else if (isImageModel) {
        const imageModelKey =
          Object.keys(IMAGE_PRICING).find((key) => usage.model_name.toLowerCase().includes(key.toLowerCase())) ||
          "gpt-image-1";
        cost = IMAGE_PRICING[imageModelKey]?.cost || 0.02;
        inputTokens = 1;
        outputTokens = 1;
      } else {
        if (usage.input_tokens !== null && usage.output_tokens !== null) {
          inputTokens = usage.input_tokens;
          outputTokens = usage.output_tokens;
        } else {
          const inputCharacters = usage.message_content?.length || 0;
          inputTokens = charsToTokens(inputCharacters);
          outputTokens = Math.floor(inputTokens * 2.5);
        }

        const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
        const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
        const isGrokModel = usage.model_name.toLowerCase().includes("grok");
        const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
        let provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" = "openai";

        if (isGeminiModel) provider = "gemini";
        else if (isClaudeModel) provider = "claude";
        else if (isGrokModel) provider = "grok";
        else if (isDeepSeekModel) provider = "deepseek";

        const inputCost = inputTokens * getCostPerToken(usage.model_name, "input", provider);
        const outputCost = outputTokens * getCostPerToken(usage.model_name, "output", provider);
        cost = inputCost + outputCost;
      }

      const revenue = cost * 3;
      const profit = revenue - cost;
      const totalTokens = inputTokens + outputTokens;

      const existing = userMap.get(usage.user_id);
      if (existing) {
        existing.totalCost += cost;
        existing.totalRevenue += revenue;
        existing.totalProfit += profit;
        existing.totalTokens += totalTokens;
        existing.transactionCount += 1;
      } else {
        userMap.set(usage.user_id, {
          user_id: usage.user_id,
          email: usage.user_id, // Will be updated with actual email if available
          totalCost: cost,
          totalRevenue: revenue,
          totalProfit: profit,
          totalTokens: totalTokens,
          transactionCount: 1,
        });
      }
    });

    return Array.from(userMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  const exportToCSV = () => {
    const headers = ["Email/User ID", "Custo Total (USD)", "Receita Total (USD)", "Lucro Total (USD)", "Tokens", "Transações"];
    const rows = userReports.map((report) => [
      report.email,
      report.totalCost.toFixed(4),
      report.totalRevenue.toFixed(4),
      report.totalProfit.toFixed(4),
      report.totalTokens.toString(),
      report.transactionCount.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-usuarios-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Relatório Detalhado de Uso por Usuário", 14, 22);
    
    // Date
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    
    // Provider filter info
    const providerText = selectedProvider === "todos" ? "Todos os provedores" : 
      selectedProvider === "openai" ? "OpenAI" :
      selectedProvider === "gemini" ? "Google Gemini" :
      selectedProvider === "claude" ? "Anthropic Claude" :
      selectedProvider === "grok" ? "xAI Grok" :
      selectedProvider === "deepseek" ? "DeepSeek" :
      selectedProvider === "image" ? "Imagem" :
      selectedProvider === "video" ? "Vídeo" : selectedProvider;
    
    const periodText = selectedPeriod === "all" ? "Todos os períodos" :
      selectedPeriod === "today" ? "Hoje" :
      selectedPeriod === "week" ? "Última semana" :
      selectedPeriod === "month" ? "Último mês" :
      selectedPeriod === "year" ? "Último ano" : selectedPeriod;
    
    doc.text(`Filtros: ${providerText} - ${periodText}`, 14, 36);
    
    // Table
    autoTable(doc, {
      startY: 42,
      head: [["Email/User ID", "Custo (USD)", "Receita (USD)", "Lucro (USD)", "Tokens", "Trans."]],
      body: userReports.map((report) => [
        report.email.substring(0, 30),
        `$${report.totalCost.toFixed(4)}`,
        `$${report.totalRevenue.toFixed(4)}`,
        `$${report.totalProfit.toFixed(4)}`,
        report.totalTokens.toLocaleString(),
        report.transactionCount.toString(),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`relatorio-usuarios-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        console.log("Fetching admin data via edge function...");

        // Call the admin-data edge function that bypasses RLS
        const { data: response, error } = await supabase.functions.invoke("admin-data");

        if (error) {
          console.error("Function error:", error);
          throw error;
        }

        if (!response.success) {
          throw new Error(response.error);
        }

        const allUsage = response.data;
        console.log("Token usage data fetched:", allUsage?.length, "records");

        if (allUsage) {
          console.log("Raw usage data sample:", allUsage.slice(0, 3));
          console.log("Selected provider for calculation:", selectedProvider);
          const calculatedStats = calculateAdminStats(allUsage, selectedProvider, selectedPeriod);
          console.log("Calculated stats for", selectedProvider, ":", calculatedStats);
          setAdminStats(calculatedStats);
          setRecentUsage(allUsage.slice(0, 15)); // Show last 15 transactions
          setAllUsageData(allUsage); // Store all usage data for alerts
          
          // Calculate user reports
          const reports = calculateUserReports(allUsage, selectedProvider, selectedPeriod);
          setUserReports(reports);
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && isAdmin) {
      fetchAdminData();

      // Auto-refresh every 30 seconds (reduced from 5s to improve performance)
      const interval = setInterval(fetchAdminData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, authLoading, user, selectedProvider, selectedPeriod]);

  // Realtime updates para custos em tempo real (incluindo imagens)
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-dashboard-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "token_usage",
        },
        (payload) => {
          console.log("Nova entrada de token_usage recebida (realtime):", payload.new);
          // Adicionar o novo registro aos dados existentes e recalcular stats
          setRecentUsage((prev) => {
            const newEntry = payload.new as TokenUsage;
            const newUsage = [newEntry, ...prev];
            const stats = calculateAdminStats(newUsage, selectedProvider, selectedPeriod);
            setAdminStats(stats);
            return newUsage.slice(0, 15); // Manter apenas os 15 mais recentes
          });
        },
      )
      .subscribe();

    console.log("Realtime subscription ativa para token_usage (custos de imagem inclusos)");

    return () => {
      console.log("Removendo subscription realtime");
      supabase.removeChannel(channel);
    };
  }, [isAdmin, selectedProvider, selectedPeriod]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && user !== null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">Você não tem permissões de administrador para acessar esta área.</p>
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="self-start">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-4 sm:h-6 w-4 sm:w-6 text-primary" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <Alert className="mb-4 sm:mb-6">
          <Shield className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="text-xs sm:text-sm">
            <strong>Dashboard administrativo</strong> com visão completa de todos os custos e receitas do hub.
            <br className="hidden sm:block" />
            <span className="text-xs text-muted-foreground block sm:inline mt-1 sm:mt-0">
              • Conversão: 4 caracteres = 1 token • Margem de lucro: 200% (3x custo) • Cálculo automático para OpenAI e
              Gemini
            </span>
          </AlertDescription>
        </Alert>

        {/* Admin Alerts System */}
        <div className="mb-4 sm:mb-6">
          <AdminAlerts
            usageData={allUsageData}
            totalCost={adminStats.totalCost}
            calculateCost={calculateSingleCost}
          />
        </div>

        {/* Period Filter */}
        <div className="mb-4 sm:mb-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-base sm:text-lg">Filtros de Período</CardTitle>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Select
                    value={selectedPeriod}
                    onValueChange={(value: "today" | "week" | "month" | "year" | "all") => setSelectedPeriod(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Selecionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="year">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedProvider}
                    onValueChange={(value: "openai" | "gemini" | "claude" | "grok" | "deepseek" | "image" | "video" | "todos") =>
                      setSelectedProvider(value)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Selecionar provedor" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="claude">Anthropic Claude</SelectItem>
                      <SelectItem value="grok">xAI Grok</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Stats Cards */}
        <AdminStatsCards {...adminStats} selectedProvider={selectedProvider} />

        {/* Storage Cleanup */}
        <div className="mb-8">
          <StorageCleanup />
        </div>

        {/* Provider Selection and Pricing Table */}
        <div className="mb-8">
          <Card>
            <Collapsible>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <CardTitle>Preços dos Modelos de IA</CardTitle>
                  <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <UnifiedPricingTable
                    selectedProvider={selectedProvider}
                    openaiPricing={OPENAI_PRICING}
                    geminiPricing={GEMINI_PRICING}
                    claudePricing={CLAUDE_PRICING}
                    grokPricing={GROK_PRICING}
                    deepseekPricing={DEEPSEEK_PRICING}
                    imagePricing={IMAGE_PRICING}
                    videoPricing={VIDEO_PRICING}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Recent Usage */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              Transações Recentes
              {(selectedProvider !== "todos" || selectedPeriod !== "all") && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (
                  {selectedProvider !== "todos" &&
                    `${
                      selectedProvider === "openai"
                        ? "OpenAI"
                        : selectedProvider === "gemini"
                          ? "Google Gemini"
                          : selectedProvider === "claude"
                            ? "Anthropic Claude"
                            : selectedProvider === "grok"
                              ? "xAI Grok"
                              : selectedProvider === "deepseek"
                                ? "DeepSeek"
                                : selectedProvider
                    }`}
                  {selectedProvider !== "todos" && selectedPeriod !== "all" && " • "}
                  {selectedPeriod !== "all" &&
                    `${
                      selectedPeriod === "today"
                        ? "Hoje"
                        : selectedPeriod === "week"
                          ? "Última semana"
                          : selectedPeriod === "month"
                            ? "Último mês"
                            : selectedPeriod === "year"
                              ? "Último ano"
                              : selectedPeriod
                    }`}
                  )
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter recent usage based on selected provider and period
              let filteredUsage = recentUsage;

              // First filter by period
              const dateRange = getDateFilterRange(selectedPeriod);
              if (dateRange) {
                filteredUsage = filteredUsage.filter((usage) => {
                  const usageDate = new Date(usage.created_at);
                  return usageDate >= dateRange.start && usageDate <= dateRange.end;
                });
              }

              // Then filter by provider
              if (selectedProvider !== "todos") {
                filteredUsage = filteredUsage.filter((usage) => {
                  const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
                  const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
                  const isGrokModel = usage.model_name.toLowerCase().includes("grok");
                  const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");

                  if (selectedProvider === "gemini") return isGeminiModel;
                  if (selectedProvider === "claude") return isClaudeModel;
                  if (selectedProvider === "grok") return isGrokModel;
                  if (selectedProvider === "deepseek") return isDeepSeekModel;
                  return !isGeminiModel && !isClaudeModel && !isGrokModel && !isDeepSeekModel; // OpenAI models
                });
              }

              return filteredUsage.length > 0 ? (
                <div className="space-y-4">
                  {filteredUsage.map((usage) => {
                    // Detect if this is an image model
                    const isImageModel =
                      Object.keys(IMAGE_PRICING).some((key) =>
                        usage.model_name.toLowerCase().includes(key.toLowerCase()),
                      ) || usage.model_name === "google:4@1";

                    let totalCost = 0;
                    let inputTokens = 0;
                    let outputTokens = 0;
                    let totalTokens = 0;

                    if (isImageModel) {
                      // For image models, use fixed cost per image
                      const imageModelKey = Object.keys(IMAGE_PRICING).find((key) =>
                        usage.model_name.toLowerCase().includes(key.toLowerCase()),
                      );

                      if (imageModelKey) {
                        totalCost = IMAGE_PRICING[imageModelKey].cost;
                      } else if (usage.model_name === "google:4@1") {
                        totalCost = 0.039; // Old Gemini Flash Image records
                      } else {
                        totalCost = IMAGE_PRICING["gpt-image-1"]?.cost || 0.02;
                      }

                      // For display purposes
                      inputTokens = 1;
                      outputTokens = 1;
                      totalTokens = 1;
                    } else {
                      // For text models, use real token data if available, otherwise estimate
                      if (usage.input_tokens !== null && usage.output_tokens !== null) {
                        // Use real token data from database
                        inputTokens = usage.input_tokens;
                        outputTokens = usage.output_tokens;
                      } else {
                        // Fallback to estimation for old records
                        const inputCharacters = usage.message_content?.length || 0;
                        inputTokens = charsToTokens(inputCharacters);
                        outputTokens = Math.floor(inputTokens * 2.5);
                      }

                      // Detect provider based on model name
                      const isGeminiModel = usage.model_name.toLowerCase().includes("gemini");
                      const isClaudeModel = usage.model_name.toLowerCase().includes("claude");
                      const isGrokModel = usage.model_name.toLowerCase().includes("grok");
                      const isDeepSeekModel = usage.model_name.toLowerCase().includes("deepseek");
                      let provider: "openai" | "gemini" | "claude" | "grok" | "deepseek" = "openai";

                      if (isGeminiModel) provider = "gemini";
                      else if (isClaudeModel) provider = "claude";
                      else if (isGrokModel) provider = "grok";
                      else if (isDeepSeekModel) provider = "deepseek";

                      // Calculate costs using correct pricing per token type
                      const inputCost = inputTokens * getCostPerToken(usage.model_name, "input", provider);
                      const outputCost = outputTokens * getCostPerToken(usage.model_name, "output", provider);
                      totalCost = inputCost + outputCost;
                      totalTokens = inputTokens + outputTokens;
                    }

                    const inputCharacters = usage.message_content?.length || 0;

                    // Revenue calculation: cost + 200% profit margin = 3x cost
                    const revenue = totalCost * 3;
                    const profit = revenue - totalCost;

                    return (
                      <div key={usage.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="font-medium text-sm">{usage.model_name}</span>
                            <span className="text-xs text-muted-foreground">{totalTokens.toLocaleString()} tokens</span>
                            <span className="text-xs text-muted-foreground">
                              {inputCharacters.toLocaleString()} caracteres
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary">+${profit.toFixed(4)}</div>
                          <div className="text-xs text-muted-foreground">
                            Custo: ${totalCost.toFixed(4)} → Receita: ${revenue.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {(() => {
                    let message = "Nenhuma transação encontrada";

                    if (selectedProvider !== "todos" || selectedPeriod !== "all") {
                      message += " para";

                      if (selectedProvider !== "todos") {
                        const providerName =
                          selectedProvider === "openai"
                            ? "OpenAI"
                            : selectedProvider === "gemini"
                              ? "Google Gemini"
                              : selectedProvider === "claude"
                                ? "Anthropic Claude"
                                : selectedProvider === "grok"
                                  ? "xAI Grok"
                                  : selectedProvider === "deepseek"
                                    ? "DeepSeek"
                                    : selectedProvider;
                        message += ` ${providerName}`;
                      }

                      if (selectedProvider !== "todos" && selectedPeriod !== "all") {
                        message += " no período";
                      }

                      if (selectedPeriod !== "all") {
                        const periodName =
                          selectedPeriod === "today"
                            ? "hoje"
                            : selectedPeriod === "week"
                              ? "da última semana"
                              : selectedPeriod === "month"
                                ? "do último mês"
                                : selectedPeriod === "year"
                                  ? "do último ano"
                                  : selectedPeriod;
                        message += selectedProvider !== "todos" ? ` ${periodName}` : ` ${periodName}`;
                      }
                    }

                    return message;
                  })()}
                </p>
              );
            })()}
          </CardContent>
        </Card>

        {/* User Reports */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Relatório Detalhado por Usuário</CardTitle>
              <div className="flex gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
                <Button onClick={exportToPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {userReports.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email/User ID</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">Receita Total</TableHead>
                      <TableHead className="text-right">Lucro Total</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Transações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userReports.map((report) => (
                      <TableRow key={report.user_id}>
                        <TableCell className="font-medium">
                          {report.email.length > 30 ? `${report.email.substring(0, 30)}...` : report.email}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${report.totalCost.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${report.totalRevenue.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right text-primary font-medium">
                          ${report.totalProfit.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">{report.totalTokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{report.transactionCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum relatório disponível para os filtros selecionados
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
