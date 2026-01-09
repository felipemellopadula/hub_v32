import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SettingsStatsProps {
  planLabel: string;
  tokensRemaining: number;
  cycleStart: Date;
  cycleEnd: Date;
  nextReset: Date;
  isLegacyUser?: boolean;
}

const TOTAL_TOKENS = 1_000_000;

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export default function SettingsStats({ planLabel, tokensRemaining, cycleStart, cycleEnd, nextReset, isLegacyUser = false }: SettingsStatsProps) {
  const balanceLabel = isLegacyUser ? "Tokens disponíveis" : "Créditos disponíveis";
  const unitLabel = isLegacyUser ? "tokens" : "créditos";
  
  // Para usuários legados, mostra barra de progresso baseada em 1M tokens
  // Para novos usuários, não mostra barra (créditos são simples)
  const used = isLegacyUser ? Math.max(0, TOTAL_TOKENS - (tokensRemaining || 0)) : 0;
  const percent = isLegacyUser ? Math.min(100, Math.max(0, (used / TOTAL_TOKENS) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do ciclo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <p className="text-lg font-semibold text-foreground">{planLabel}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{balanceLabel}</p>
            <p className="text-lg font-semibold text-foreground">{tokensRemaining?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ciclo</p>
            <p className="text-lg font-semibold text-foreground">{formatDate(cycleStart)} — {formatDate(cycleEnd)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Renova em</p>
            <p className="text-lg font-semibold text-foreground">{formatDate(nextReset)}</p>
          </div>
        </div>

        {isLegacyUser && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uso no ciclo</span>
              <span className="text-sm text-muted-foreground">{used.toLocaleString()} / {TOTAL_TOKENS.toLocaleString()}</span>
            </div>
            <Progress value={percent} />
          </div>
        )}

        {!isLegacyUser && (
          <p className="text-xs text-muted-foreground">
            1 crédito = 1 imagem ou 1 vídeo
          </p>
        )}
      </CardContent>
    </Card>
  );
}
