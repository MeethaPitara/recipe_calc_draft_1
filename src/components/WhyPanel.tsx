import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Metrics } from '@/lib/calc';

interface WhyPanelProps {
  metrics: Metrics;
  previousMetrics?: Metrics;
  changes?: string[];
}

export default function WhyPanel({ metrics, previousMetrics, changes = [] }: WhyPanelProps) {
  const explanations: string[] = [];

  // Generate explanations based on metrics and changes
  if (previousMetrics) {
    // SP changes
    if (Math.abs(metrics.sp - previousMetrics.sp) > 0.5) {
      const direction = metrics.sp > previousMetrics.sp ? 'increased' : 'decreased';
      const reason = metrics.sp > previousMetrics.sp 
        ? 'adding more fructose or reducing lactose' 
        : 'reducing fructose or adding more lactose';
      explanations.push(
        `SP (Sweetness Power) ${direction} from ${previousMetrics.sp.toFixed(1)} to ${metrics.sp.toFixed(1)} by ${reason}. This affects perceived sweetness intensity.`
      );
    }

    // PAC changes
    if (Math.abs(metrics.pac - previousMetrics.pac) > 0.5) {
      const direction = metrics.pac > previousMetrics.pac ? 'raised' : 'lowered';
      const tempEffect = metrics.pac > previousMetrics.pac 
        ? 'softer at the same temperature' 
        : 'firmer at the same temperature';
      explanations.push(
        `We ${direction} PAC from ${previousMetrics.pac.toFixed(1)} to ${metrics.pac.toFixed(1)} by adjusting sugar types (dextrose↑). This makes the product ${tempEffect}.`
      );
    }

    // Fat changes
    if (Math.abs(metrics.fat_pct - previousMetrics.fat_pct) > 1) {
      const direction = metrics.fat_pct > previousMetrics.fat_pct ? 'increased' : 'decreased';
      explanations.push(
        `Fat content ${direction} from ${previousMetrics.fat_pct.toFixed(1)}% to ${metrics.fat_pct.toFixed(1)}%, affecting body, mouthfeel, and richness.`
      );
    }
  } else {
    // Initial explanations when no previous metrics
    if (metrics.pac < 22) {
      explanations.push(
        `⚠️ Low PAC (${metrics.pac.toFixed(1)}) means the product will be very hard at typical cabinet temps (-18°C). Consider raising by adding dextrose or glucose syrup.`
      );
    }
    
    if (metrics.pac > 33) {
      explanations.push(
        `⚠️ High PAC (${metrics.pac.toFixed(1)}) means the product will be too soft and may not hold its shape. Consider reducing dextrose and increasing sucrose.`
      );
    }

    if (metrics.sp < 12) {
      explanations.push(
        `💡 Low SP (${metrics.sp.toFixed(1)}) indicates mild sweetness. Increase fructose or invert sugar for more sweetness punch without adding more total sugars.`
      );
    }

    if (metrics.sp > 28) {
      explanations.push(
        `⚠️ High SP (${metrics.sp.toFixed(1)}) may taste overly sweet. Replace some fructose with lactose or maltodextrin to reduce perceived sweetness while maintaining body.`
      );
    }

    if (metrics.ts_add_pct < 30) {
      explanations.push(
        `⚠️ Total solids (${metrics.ts_add_pct.toFixed(1)}%) is low. This may result in icy texture. Increase MSNF or add stabilizers.`
      );
    }

    if (metrics.water_pct > 70) {
      explanations.push(
        `💧 High water content (${metrics.water_pct.toFixed(1)}%) increases ice crystal formation risk. Consider evaporation or adding more solids.`
      );
    }
  }

  // Add change-specific explanations
  changes.forEach(change => {
    explanations.push(`🔄 ${change}`);
  });

  if (explanations.length === 0) {
    explanations.push(
      '✅ Recipe is balanced. All parameters are within optimal ranges for smooth texture and proper scoopability.'
    );
  }

  const getIcon = (text: string) => {
    if (text.includes('⚠️')) return <AlertTriangle className="h-4 w-4 text-warning" />;
    if (text.includes('↑') || text.includes('increased') || text.includes('raised')) 
      return <TrendingUp className="h-4 w-4 text-success" />;
    if (text.includes('↓') || text.includes('decreased') || text.includes('lowered')) 
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Lightbulb className="h-4 w-4 text-info" />;
  };

  const getBadgeVariant = (text: string): "default" | "secondary" | "outline" | "destructive" => {
    if (text.includes('⚠️')) return 'destructive';
    if (text.includes('✅')) return 'default';
    return 'secondary';
  };

  return (
    <Card className="p-4 space-y-3 bg-gradient-card border-info/20">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Why These Changes?</h3>
        <Badge variant="outline" className="text-xs">Science Explained</Badge>
      </div>

      <div className="space-y-2">
        {explanations.map((explanation, idx) => (
          <div 
            key={idx} 
            className="flex items-start gap-2 p-3 bg-card/80 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
          >
            {getIcon(explanation)}
            <p className="text-sm flex-1">{explanation.replace(/[⚠️💡💧🔄✅]/g, '').trim()}</p>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground italic">
          💡 Pro tip: Small changes in sugar ratios have big impacts on texture. Always test and log batches to calibrate your system.
        </p>
      </div>
    </Card>
  );
}
