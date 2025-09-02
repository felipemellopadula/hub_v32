import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Zap } from "lucide-react";

interface AdminStatsCardsProps {
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalUsers: number;
  totalTokens: number;
}

export const AdminStatsCards = ({
  totalCost,
  totalRevenue,
  totalProfit,
  totalUsers,
  totalTokens
}: AdminStatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            ${totalCost.toFixed(4)}
          </div>
          <p className="text-xs text-muted-foreground">
            Gasto com tokens OpenAI
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            ${totalRevenue.toFixed(4)}
          </div>
          <p className="text-xs text-muted-foreground">
            Valor cobrado dos usuários
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ${totalProfit.toFixed(4)}
          </div>
          <p className="text-xs text-muted-foreground">
            Margem de {totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(0) : 0}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {totalUsers}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalTokens.toLocaleString()} tokens usados
          </p>
        </CardContent>
      </Card>
    </div>
  );
};