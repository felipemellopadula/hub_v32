import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Grok model pricing data (per million tokens)
const GROK_MODELS = [
  {
    name: "grok-4",
    description: "The world's best model, at your fingertips. (New)",
    inputPrice: 3.00,
    outputPrice: 15.00,
    context: "256K tokens"
  },
  {
    name: "grok-3",
    description: "Flagship model that excels at enterprise tasks",
    inputPrice: 3.00,
    outputPrice: 15.00,
    context: "131K tokens"
  },
  {
    name: "grok-3-mini",
    description: "Lightweight model for quantitative tasks",
    inputPrice: 0.30,
    outputPrice: 0.50,
    context: "131K tokens"
  }
];

export const GrokPricingTable = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-orange-400">Preços dos Modelos Grok (xAI)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead className="text-right">Entrada (USD/1M tokens)</TableHead>
                <TableHead className="text-right">Saída (USD/1M tokens)</TableHead>
                <TableHead className="text-right">Custo por Token (Entrada)</TableHead>
                <TableHead className="text-right">Custo por Token (Saída)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GROK_MODELS.map((model) => (
                <TableRow key={model.name}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-sm text-muted-foreground">{model.description}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{model.context}</TableCell>
                  <TableCell className="text-right font-mono text-orange-400">
                    ${model.inputPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-400">
                    ${model.outputPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-400">
                    ${(model.inputPrice / 1_000_000).toFixed(10)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-400">
                    ${(model.outputPrice / 1_000_000).toFixed(10)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          * Preços baseados na documentação oficial do xAI (Janeiro 2025)
        </div>
      </CardContent>
    </Card>
  );
};