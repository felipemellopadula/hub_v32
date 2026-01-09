import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditPurchase {
  id: string;
  created_at: string;
  plan_name: string | null;
  tokens_credited: number;
  amount_paid: number | null;
  currency: string | null;
}

const PurchaseHistory = () => {
  const { user } = useAuth();

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['credit-purchases', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_purchases')
        .select('id, created_at, plan_name, tokens_credited, amount_paid, currency')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditPurchase[];
    },
    enabled: !!user?.id,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (amount === null) return '-';
    const value = amount / 100; // Stripe usa centavos
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency?.toUpperCase() || 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Histórico de Compras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Histórico de Compras
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!purchases || purchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma compra realizada ainda</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead className="text-right">Créditos</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(purchase.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {purchase.plan_name || 'Pacote de Créditos'}
                  </TableCell>
                  <TableCell className="text-right text-green-500 font-medium">
                    +{purchase.tokens_credited.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(purchase.amount_paid, purchase.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PurchaseHistory;
