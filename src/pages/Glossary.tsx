import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Glossary() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Calculator
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <BookOpen className="h-8 w-8 text-primary" />
              Ice Cream Science Glossary
            </CardTitle>
            <CardDescription>
              Essential terms and concepts for professional gelato and ice cream formulation
            </CardDescription>
          </CardHeader>
        </Card>

        <Card id="fpdt">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">FPDT - Freezing Point Depression Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The total depression of the freezing point below 0°C. This determines how soft or hard your ice cream will be at serving temperature.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold">Target Ranges:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Gelato: 2.5-3.5°C</Badge>
                <Badge variant="outline">Ice Cream: 2.0-3.0°C</Badge>
                <Badge variant="outline">Kulfi: 2.0-2.5°C</Badge>
                <Badge variant="outline">Sorbet: 3.0-4.0°C</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Lower FPDT</strong> = firmer texture (more frozen water)<br/>
              <strong>Higher FPDT</strong> = softer texture (less frozen water)
            </p>
            <Separator />
            <div className="space-y-2">
              <p className="font-semibold">Components:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong>FPDSE</strong> - Freezing Point Depression from Sugars and sugar Equivalents</li>
                <li><strong>FPDSA</strong> - Freezing Point Depression from Salts and Acids (minerals, citric acid)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card id="msnf">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">MSNF - Milk Solids Non-Fat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              All the solids in milk except fat: primarily protein (casein & whey) and lactose, plus minerals.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold">Target Ranges:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Gelato: 7-9%</Badge>
                <Badge variant="outline">Ice Cream: 9-12%</Badge>
                <Badge variant="outline">Kulfi: 18-25%</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Functions:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Adds body and improves mouthfeel</li>
                <li>Provides nutrition (protein, calcium)</li>
                <li>Helps with overrun and air bubble stability</li>
                <li>Contains lactose (contributes sweetness)</li>
              </ul>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                <strong>⚠️ Warning:</strong> Too much MSNF means high lactose. Keep lactose under 11% to avoid sandiness (lactose crystallization).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card id="pod">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">POD - Protein Other than Dairy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              A ratio-based index (typically 100-120) that balances total solids, fat, and non-dairy protein for optimal structure.
            </p>
            <div className="bg-muted rounded-lg p-4">
              <p className="font-semibold mb-2">Interpretation:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><strong>&lt; 100:</strong> Low body, may lack structure</li>
                <li><strong>100-120:</strong> Balanced, professional range</li>
                <li><strong>&gt; 120:</strong> Rich, dense texture (kulfi style)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card id="pac">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">PAC - Anti-freezing Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Measures how much each sugar lowers the freezing point relative to sucrose (baseline = 1.00).
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold">Common Sugar PAC Values:</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Dextrose (Glucose)</span>
                  <Badge variant="secondary">1.90</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Fructose</span>
                  <Badge variant="secondary">1.90</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Invert Sugar</span>
                  <Badge variant="secondary">1.90</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Sucrose (baseline)</span>
                  <Badge variant="secondary">1.00</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Lactose</span>
                  <Badge variant="secondary">1.00</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Higher PAC sugars like dextrose create softer textures at the same temperature.
            </p>
          </CardContent>
        </Card>

        <Card id="sp">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">SP - Sweetness Power</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Relative perceived sweetness compared to sucrose (table sugar = 1.00).
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold">Common Sugar SP Values:</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Fructose</span>
                  <Badge variant="secondary">1.73</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Sucrose (baseline)</span>
                  <Badge variant="secondary">1.00</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Glucose/Dextrose</span>
                  <Badge variant="secondary">0.70</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Lactose</span>
                  <Badge variant="secondary">0.16</Badge>
                </div>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="font-semibold mb-2">Target Ranges:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Ice Cream: 14-18</Badge>
                <Badge variant="outline">Gelato: 12-16</Badge>
                <Badge variant="outline">Sorbet: 16-22</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="overrun">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Overrun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The percentage increase in volume from air incorporation during churning.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold">Typical Ranges:</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Gelato (batch freezer)</span>
                  <Badge variant="secondary">20-40%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Ice Cream (batch)</span>
                  <Badge variant="secondary">40-60%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Ice Cream (continuous)</span>
                  <Badge variant="secondary">80-120%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Premium Ice Cream</span>
                  <Badge variant="secondary">20-40%</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Formula: <code className="bg-muted px-2 py-1 rounded">Overrun = ((Final Volume - Initial Volume) / Initial Volume) × 100</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Additional Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="font-semibold">Recommended Reading:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><em>Ice Cream (7th ed.)</em> - Goff & Hartel</li>
                <li>MEC3 Technical Bulletins</li>
                <li>Carpigiani Gelato University courses</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
