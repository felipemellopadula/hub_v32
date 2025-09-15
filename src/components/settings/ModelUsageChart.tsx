import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ModelUsageChartProps {
  cycleStart: Date;
  cycleEnd: Date;
}

interface UsageRow {
  model_name: string;
  tokens_used: number;
  created_at: string;
}

interface PieDatum {
  name: string;
  value: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--foreground))",
];

export default function ModelUsageChart({ cycleStart, cycleEnd }: ModelUsageChartProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PieDatum[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("token_usage")
        .select("model_name,tokens_used,created_at")
        .gte("created_at", cycleStart.toISOString())
        .lt("created_at", cycleEnd.toISOString());

      if (error) {
        console.error(error);
        toast({ title: "Erro ao carregar uso", description: "Não foi possível obter os dados de uso.", variant: "destructive" });
        if (isMounted) setLoading(false);
        return;
      }

      const map = new Map<string, number>();
      (data as UsageRow[]).forEach((row) => {
        const key = row.model_name || "Desconhecido";
        map.set(key, (map.get(key) || 0) + (row.tokens_used || 0));
      });

      const pieData: PieDatum[] = Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

      if (isMounted) {
        setData(pieData);
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [cycleStart, cycleEnd, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso por modelo (ciclo atual)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem uso registrado neste ciclo.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius={25} 
                  outerRadius={60} 
                  paddingAngle={2}
                  fontSize={12}
                  cx="50%"
                  cy="45%"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{
                    fontSize: '11px',
                    color: 'hsl(var(--foreground))',
                    paddingTop: '10px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
