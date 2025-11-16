import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const OPENAI_MODELS = [
  {
    name: 'GPT-5.1',
    inputPrice: '$1.25',
    outputPrice: '$10.00',
    inputCostPerToken: '$0.00000125',
    outputCostPerToken: '$0.00001000'
  },
  {
    name: 'GPT-5 Mini',
    inputPrice: '$0.25',
    outputPrice: '$2.00',
    inputCostPerToken: '$0.00000025',
    outputCostPerToken: '$0.00000200'
  },
  {
    name: 'GPT-5 Nano',
    inputPrice: '$0.05',
    outputPrice: '$0.40',
    inputCostPerToken: '$0.00000005',
    outputCostPerToken: '$0.00000040'
  },
  {
    name: 'GPT-4.1',
    inputPrice: '$3.00',
    outputPrice: '$12.00',
    inputCostPerToken: '$0.00000300',
    outputCostPerToken: '$0.00001200'
  },
  {
    name: 'GPT-4.1 Mini',
    inputPrice: '$0.80',
    outputPrice: '$3.20',
    inputCostPerToken: '$0.00000080',
    outputCostPerToken: '$0.00000320'
  },
  {
    name: 'GPT-4.1 Nano',
    inputPrice: '$0.20',
    outputPrice: '$0.80',
    inputCostPerToken: '$0.00000020',
    outputCostPerToken: '$0.00000080'
  },
  {
    name: 'O4 Mini',
    inputPrice: '$4.00',
    outputPrice: '$16.00',
    inputCostPerToken: '$0.00000400',
    outputCostPerToken: '$0.00001600'
  },
  {
    name: 'GPT-4o Mini',
    inputPrice: '$0.15',
    outputPrice: '$0.60',
    inputCostPerToken: '$0.00000015',
    outputCostPerToken: '$0.00000060'
  }
];

export const OpenAIPricingTable = () => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Tabela de Preços OpenAI</CardTitle>
        <p className="text-sm text-muted-foreground">Preços por 1 milhão de tokens (USD)</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Entrada (USD/1M tokens)</TableHead>
                <TableHead>Saída (USD/1M tokens)</TableHead>
                <TableHead>Custo por Token (Entrada)</TableHead>
                <TableHead>Custo por Token (Saída)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OPENAI_MODELS.map((model) => (
                <TableRow key={model.name}>
                  <TableCell className="font-medium">{model.name}</TableCell>
                  <TableCell className="text-blue-600">{model.inputPrice}</TableCell>
                  <TableCell className="text-blue-600">{model.outputPrice}</TableCell>
                  <TableCell className="text-blue-600">{model.inputCostPerToken}</TableCell>
                  <TableCell className="text-blue-600">{model.outputCostPerToken}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};