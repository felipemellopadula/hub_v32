import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  Bell, 
  BellOff, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Activity,
  Settings,
  X,
  CheckCircle2
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface AlertConfig {
  dailyCostLimit: number;
  weeklyCostLimit: number;
  monthlyCostLimit: number;
  highUsageThreshold: number; // requests per hour
  unusualTimeAlerts: boolean;
  newUserSpendingLimit: number;
}

interface AdminAlert {
  id: string;
  type: "cost" | "usage" | "suspicious" | "info";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  dismissed: boolean;
}

interface AdminAlertsProps {
  usageData: TokenUsage[];
  totalCost: number;
  calculateCost: (usage: TokenUsage) => number;
}

const DEFAULT_CONFIG: AlertConfig = {
  dailyCostLimit: 50,
  weeklyCostLimit: 200,
  monthlyCostLimit: 500,
  highUsageThreshold: 100,
  unusualTimeAlerts: true,
  newUserSpendingLimit: 10,
};

export const AdminAlerts = ({ usageData, totalCost, calculateCost }: AdminAlertsProps) => {
  const [config, setConfig] = useState<AlertConfig>(() => {
    const saved = localStorage.getItem("admin-alert-config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    const saved = localStorage.getItem("dismissed-admin-alerts");
    return saved ? JSON.parse(saved) : [];
  });

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem("admin-alert-config", JSON.stringify(config));
  }, [config]);

  // Save dismissed alerts to localStorage
  useEffect(() => {
    localStorage.setItem("dismissed-admin-alerts", JSON.stringify(dismissedAlerts));
  }, [dismissedAlerts]);

  // Generate alerts based on usage data
  const alerts = useMemo(() => {
    const generatedAlerts: AdminAlert[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Calculate daily, weekly, monthly costs
    let dailyCost = 0;
    let weeklyCost = 0;
    let monthlyCost = 0;
    
    // Track user activity
    const userActivity: Record<string, { requests: number; cost: number; lastHour: number }> = {};
    const userFirstSeen: Record<string, Date> = {};
    
    usageData.forEach((usage) => {
      const usageDate = new Date(usage.created_at);
      const cost = calculateCost(usage);
      
      if (usageDate >= today) dailyCost += cost;
      if (usageDate >= weekAgo) weeklyCost += cost;
      if (usageDate >= monthAgo) monthlyCost += cost;
      
      // Track per-user activity
      if (usage.user_id) {
        if (!userActivity[usage.user_id]) {
          userActivity[usage.user_id] = { requests: 0, cost: 0, lastHour: 0 };
        }
        userActivity[usage.user_id].requests += 1;
        userActivity[usage.user_id].cost += cost;
        
        if (usageDate >= hourAgo) {
          userActivity[usage.user_id].lastHour += 1;
        }
        
        // Track first activity time for "new users"
        if (!userFirstSeen[usage.user_id] || usageDate < userFirstSeen[usage.user_id]) {
          userFirstSeen[usage.user_id] = usageDate;
        }
      }
    });

    // Alert: Daily cost limit exceeded
    if (dailyCost > config.dailyCostLimit) {
      generatedAlerts.push({
        id: `daily-cost-${today.toISOString().split('T')[0]}`,
        type: "cost",
        severity: "high",
        title: "Limite de custo diário excedido",
        description: `Custo hoje: $${dailyCost.toFixed(2)} (limite: $${config.dailyCostLimit.toFixed(2)})`,
        timestamp: now,
        dismissed: false,
      });
    } else if (dailyCost > config.dailyCostLimit * 0.8) {
      generatedAlerts.push({
        id: `daily-cost-warning-${today.toISOString().split('T')[0]}`,
        type: "cost",
        severity: "medium",
        title: "Custo diário próximo do limite",
        description: `Custo hoje: $${dailyCost.toFixed(2)} (80% do limite de $${config.dailyCostLimit.toFixed(2)})`,
        timestamp: now,
        dismissed: false,
      });
    }

    // Alert: Weekly cost limit exceeded
    if (weeklyCost > config.weeklyCostLimit) {
      generatedAlerts.push({
        id: `weekly-cost-${weekAgo.toISOString().split('T')[0]}`,
        type: "cost",
        severity: "high",
        title: "Limite de custo semanal excedido",
        description: `Custo na semana: $${weeklyCost.toFixed(2)} (limite: $${config.weeklyCostLimit.toFixed(2)})`,
        timestamp: now,
        dismissed: false,
      });
    }

    // Alert: Monthly cost limit exceeded
    if (monthlyCost > config.monthlyCostLimit) {
      generatedAlerts.push({
        id: `monthly-cost-${monthAgo.toISOString().split('T')[0]}`,
        type: "cost",
        severity: "high",
        title: "Limite de custo mensal excedido",
        description: `Custo no mês: $${monthlyCost.toFixed(2)} (limite: $${config.monthlyCostLimit.toFixed(2)})`,
        timestamp: now,
        dismissed: false,
      });
    }

    // Alert: High usage per hour (potential abuse)
    Object.entries(userActivity).forEach(([userId, activity]) => {
      if (activity.lastHour > config.highUsageThreshold) {
        generatedAlerts.push({
          id: `high-usage-${userId}-${now.getTime()}`,
          type: "suspicious",
          severity: "high",
          title: "Uso suspeito detectado",
          description: `Usuário ${userId.substring(0, 8)}... fez ${activity.lastHour} requisições na última hora (limite: ${config.highUsageThreshold})`,
          timestamp: now,
          userId,
          dismissed: false,
        });
      }
    });

    // Alert: New user spending too much
    Object.entries(userActivity).forEach(([userId, activity]) => {
      const firstSeen = userFirstSeen[userId];
      if (firstSeen) {
        const daysSinceFirstActivity = (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceFirstActivity < 7 && activity.cost > config.newUserSpendingLimit) {
          generatedAlerts.push({
            id: `new-user-spending-${userId}`,
            type: "suspicious",
            severity: "medium",
            title: "Novo usuário com gasto elevado",
            description: `Usuário ${userId.substring(0, 8)}... (ativo há ${daysSinceFirstActivity.toFixed(0)} dias) já gastou $${activity.cost.toFixed(2)}`,
            timestamp: now,
            userId,
            dismissed: false,
          });
        }
      }
    });

    // Alert: Unusual time activity (late night/early morning - 2am-5am)
    if (config.unusualTimeAlerts) {
      const recentUnusualActivity = usageData.filter((usage) => {
        const usageDate = new Date(usage.created_at);
        const hours = usageDate.getHours();
        return usageDate >= hourAgo && (hours >= 2 && hours < 5);
      });
      
      if (recentUnusualActivity.length > 10) {
        generatedAlerts.push({
          id: `unusual-time-${now.getTime()}`,
          type: "suspicious",
          severity: "low",
          title: "Atividade em horário incomum",
          description: `${recentUnusualActivity.length} requisições detectadas entre 2h-5h da manhã`,
          timestamp: now,
          dismissed: false,
        });
      }
    }

    // Filter out dismissed alerts
    return generatedAlerts.filter((alert) => !dismissedAlerts.includes(alert.id));
  }, [usageData, config, dismissedAlerts, calculateCost]);

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
  };

  const clearAllDismissed = () => {
    setDismissedAlerts([]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-yellow-500 text-white";
      case "low":
        return "bg-blue-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "cost":
        return <DollarSign className="h-4 w-4" />;
      case "usage":
        return <TrendingUp className="h-4 w-4" />;
      case "suspicious":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const highSeverityCount = activeAlerts.filter((a) => a.severity === "high").length;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {highSeverityCount > 0 ? (
              <Bell className="h-5 w-5 text-destructive animate-pulse" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">Sistema de Alertas</CardTitle>
            {activeAlerts.length > 0 && (
              <Badge variant={highSeverityCount > 0 ? "destructive" : "secondary"}>
                {activeAlerts.length} {activeAlerts.length === 1 ? "alerta" : "alertas"}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigOpen(!configOpen)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Configuration Panel */}
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <CollapsibleContent className="space-y-4 mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-2">Configurar Limites de Alerta</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyLimit">Limite Diário (USD)</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  value={config.dailyCostLimit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dailyCostLimit: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyLimit">Limite Semanal (USD)</Label>
                <Input
                  id="weeklyLimit"
                  type="number"
                  value={config.weeklyCostLimit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      weeklyCostLimit: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyLimit">Limite Mensal (USD)</Label>
                <Input
                  id="monthlyLimit"
                  type="number"
                  value={config.monthlyCostLimit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      monthlyCostLimit: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="highUsage">Requisições/Hora (limite)</Label>
                <Input
                  id="highUsage"
                  type="number"
                  value={config.highUsageThreshold}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      highUsageThreshold: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newUserLimit">Limite p/ Novos Usuários (USD)</Label>
                <Input
                  id="newUserLimit"
                  type="number"
                  value={config.newUserSpendingLimit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      newUserSpendingLimit: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            {dismissedAlerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllDismissed}
                className="mt-2"
              >
                Restaurar {dismissedAlerts.length} alertas descartados
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Alerts List */}
        {activeAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
            Nenhum alerta ativo no momento
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activeAlerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={alert.severity === "high" ? "destructive" : "default"}
                className="relative"
              >
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {alert.title}
                      <Badge className={getSeverityColor(alert.severity)} variant="secondary">
                        {alert.severity === "high"
                          ? "Alta"
                          : alert.severity === "medium"
                          ? "Média"
                          : "Baixa"}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-1">
                      {alert.description}
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.timestamp.toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlert(alert.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
