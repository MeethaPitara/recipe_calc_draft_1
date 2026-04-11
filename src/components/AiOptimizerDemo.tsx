/**
 * AiOptimizerDemo — Example React component showing how to use the AI pipeline.
 *
 * Import this into any page to test:
 *   import AiOptimizerDemo from '@/components/AiOptimizerDemo';
 *   <AiOptimizerDemo />
 */

import { useState, useEffect, useMemo } from 'react';
import { apiPost, apiGet } from '@/lib/apiClient';
import type { AgentResult, RecipeItem, ProductionTargets, OptimizationTargets } from '@/lib/ai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, AlertCircle, Save, Copy, CheckCircle } from 'lucide-react';
import { recipeService } from '@/services/recipeService';
import { INGREDIENT_DB } from '@/lib/ai/ingredientDb';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { SaveRecipeModal } from './SaveRecipeModal';

// ── Default test data (from Cell 13 in the notebook) ──

const DEFAULT_RECIPE: RecipeItem[] = [
    { ingredient: 'Toned Milk 3%', quantity_g: 507970.39 },
    { ingredient: 'Cream 25%', quantity_g: 142300.70 },
    { ingredient: 'Sucrose/sugar', quantity_g: 101766.56 },
    { ingredient: 'Dextrose monohydrate', quantity_g: 15523.71 },
    { ingredient: 'Glucose Syrup (40-42DE)', quantity_g: 36221.99 },
    { ingredient: 'Condensed Milk Nestle', quantity_g: 15523.71 },
    { ingredient: 'Stabilizer', quantity_g: 5174.57 },
    { ingredient: 'Skimmed Milk Powder', quantity_g: 37946.85 },
];

const DEFAULT_TARGETS: ProductionTargets = {
    lossPct: 5,
    mixDensity: 1.04,
    overrunPct: 27,
    skuSizeLiters: 0.75,
    targetVolumeLiters: 1000,
};

interface AiOptimizerDemoProps {
    recipe?: RecipeItem[];
    targetParams?: Partial<ProductionTargets>;
    idealRanges?: OptimizationTargets;
    currentMetrics?: any;
    onApplyRecipe?: (optimizedRecipe: { [key: string]: number }) => void;
}

export default function AiOptimizerDemo({ recipe, targetParams, idealRanges, currentMetrics, onApplyRecipe }: AiOptimizerDemoProps) {
    const [prompt, setPrompt] = useState('Make the texture more creamy');
    const [targetFat, setTargetFat] = useState(idealRanges?.fat_pct?.toString() || '');
    const [targetMsnf, setTargetMsnf] = useState(idealRanges?.msnf_pct?.toString() || '');
    const [targetSugar, setTargetSugar] = useState(idealRanges?.sugars_pct?.toString() || '');

    // Reset targets if idealRanges changes
    useEffect(() => {
        if (idealRanges) {
            if (idealRanges.fat_pct !== undefined && idealRanges.fat_pct !== null) setTargetFat(idealRanges.fat_pct.toString());
            if (idealRanges.msnf_pct !== undefined && idealRanges.msnf_pct !== null) setTargetMsnf(idealRanges.msnf_pct.toString());
            if (idealRanges.sugars_pct !== undefined && idealRanges.sugars_pct !== null) setTargetSugar(idealRanges.sugars_pct.toString());
        }
    }, [idealRanges]);

    const [recipes, setRecipes] = useState<any[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>('current');
    const [loadingRecipes, setLoadingRecipes] = useState(false);

    const [saving, setSaving] = useState<'new' | 'update' | null>(null);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AgentResult | null>(null);

    const fetchRecipesList = async () => {
        setLoadingRecipes(true);
        try {
            const data = await apiGet<any[]>('/api/recipes');
            setRecipes(data || []);
        } catch {
            // Silently fail - user may not be authenticated
        }
        setLoadingRecipes(false);
    };

    useEffect(() => {
        fetchRecipesList();
    }, []);

    const activeRecipe = useMemo(() => {
        if (recipe) return recipe;
        if (selectedRecipeId === 'default') return DEFAULT_RECIPE;
        const found = recipes.find(r => r.id === selectedRecipeId);
        if (found && found.recipe_rows) {
            return found.recipe_rows.map((row: any) => ({
                ingredient: row.ingredient,
                quantity_g: row.quantity_g
            }));
        }
        return DEFAULT_RECIPE;
    }, [selectedRecipeId, recipes, recipe]);

    const handleRun = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let finalPrompt = '';
            if (targetFat) finalPrompt += `Fat to ${targetFat}%, `;
            if (targetMsnf) finalPrompt += `MSNF to ${targetMsnf}%, `;
            if (targetSugar) finalPrompt += `Sugars to ${targetSugar}%, `;
            finalPrompt += prompt;

            // Calculate dynamic target volume
            const totalGrams = activeRecipe.reduce((sum, item) => sum + Number(item.quantity_g), 0);
            const dynamicTargetVolumeLiters =
                (totalGrams * (1 + DEFAULT_TARGETS.overrunPct / 100) * (1 - DEFAULT_TARGETS.lossPct / 100)) /
                (1000 * DEFAULT_TARGETS.mixDensity);

            const res = await apiPost<AgentResult>('/api/ai/optimize', {
                userPrompt: finalPrompt,
                recipe: activeRecipe,
                targetParams: {
                    ...DEFAULT_TARGETS,
                    targetVolumeLiters: dynamicTargetVolumeLiters
                },
                mode: 'gelato',
                currentMetrics,
            });
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveModalMode, setSaveModalMode] = useState<'new' | 'update'>('new');

    const handleSaveClick = (isNew: boolean) => {
        setSaveModalMode(isNew ? 'new' : 'update');
        setIsSaveModalOpen(true);
    };

    const handleSaveConfirm = async (name: string, type: string) => {
        if (!result || !result.optimized_recipe) return;

        setSaving(saveModalMode);
        setSaveMessage(null);

        try {
            let existingId: string | undefined = undefined;

            if (saveModalMode === 'update') {
                const found = recipes.find(r => r.id === selectedRecipeId);
                if (!found) throw new Error('Original recipe not found in list. Please refresh or select Save as New.');
                existingId = selectedRecipeId;
            }

            await recipeService.saveAiRecipe(
                name,
                type,
                result.optimized_recipe,
                INGREDIENT_DB,
                existingId
            );

            // Re-fetch recipes so the UI (and the active selection) stays in sync
            await fetchRecipesList();

            setSaveMessage({
                type: 'success',
                text: saveModalMode === 'new' ? 'Recipe saved as new!' : 'Original recipe updated successfully.'
            });
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: `Failed to save: ${err.message}` });
        } finally {
            setSaving(null);
            setIsSaveModalOpen(false);
        }
    };

    // Determine default values for the Modal
    const foundRecipe = recipes.find(r => r.id === selectedRecipeId);
    let modalInitialName = 'My New Recipe';
    let modalInitialType = 'gelato';

    if (foundRecipe) {
        modalInitialName = saveModalMode === 'new' ? `${foundRecipe.recipe_name} (AI Optimized)` : foundRecipe.recipe_name;
        modalInitialType = foundRecipe.product_type || 'gelato';
    } else if (selectedRecipeId === 'default' && saveModalMode === 'new') {
        modalInitialName = 'Demo Recipe (AI Optimized)';
    }

    return (
        <div className="space-y-6 w-full max-w-4xl mx-auto">
            <SaveRecipeModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveConfirm}
                initialName={modalInitialName}
                initialType={modalInitialType}
                isUpdate={saveModalMode === 'update'}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-primary flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            1. Active Base Recipe (Locked)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert className="mb-4 bg-primary/5 border-primary/20">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-xs">
                                Using the recipe currently in your calculator above.
                            </AlertDescription>
                        </Alert>
                        <div className="bg-muted/30 border rounded-md p-2 max-h-[140px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left pb-1 font-semibold text-muted-foreground">Ingredient</th>
                                        <th className="text-right pb-1 font-semibold text-muted-foreground">Qty (g)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeRecipe.map((item, i) => (
                                        <tr key={i} className="border-b last:border-0 border-border/50">
                                            <td className="py-1">{item.ingredient}</td>
                                            <td className="text-right py-1 text-muted-foreground font-mono">{Number(item.quantity_g).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">2. Target Flavor Params (Required)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fat %</Label>
                            <Input placeholder="e.g. 8 (Optional)" value={targetFat} onChange={e => setTargetFat(e.target.value)} type="number" step="0.1" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">MSNF %</Label>
                            <Input placeholder="e.g. 10 (Optional)" value={targetMsnf} onChange={e => setTargetMsnf(e.target.value)} type="number" step="0.1" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Sugar %</Label>
                            <Input placeholder="e.g. 15 (Optional)" value={targetSugar} onChange={e => setTargetSugar(e.target.value)} type="number" step="0.1" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">3. AI Prompt Instructions (Required)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="What do you want to change? (e.g. 'Make it creamier and swap sucrose for honey')"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        disabled={loading}
                        required
                    />
                    <Button
                        onClick={handleRun}
                        disabled={loading || !prompt.trim()}
                        className="w-full gap-2"
                        size="lg"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        {loading ? 'AI Optimizing Recipe...' : 'Run AI Optimizer'}
                    </Button>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Results */}
            {result && (
                <div style={{ marginTop: '1.5rem' }}>
                    {/* Status */}
                    <div style={{
                        padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem',
                        background: result.success ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`,
                    }}>
                        <strong>Status:</strong> {result.solver_status}
                    </div>

                    {/* Engineer Changes */}
                    <Section title="🔧 Engineer Changes">
                        <p>{result.engineer_changes}</p>
                    </Section>

                    {/* Metrics Comparison */}
                    <Section title="📊 Metrics">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <Th>Metric</Th><Th>Before</Th><Th>After</Th>
                                </tr>
                            </thead>
                            <tbody>
                                <MetricRow label="Fat %" before={result.metrics_before.fat_pct} after={result.metrics_after.fat_pct} />
                                <MetricRow label="MSNF %" before={result.metrics_before.msnf_pct} after={result.metrics_after.msnf_pct} />
                                <MetricRow label="Sugars %" before={result.metrics_before.sugars_pct} after={result.metrics_after.sugars_pct} />
                                <MetricRow label="Water %" before={result.metrics_before.water_pct} after={result.metrics_after.water_pct} />
                                <MetricRow label="Total Solids %" before={result.metrics_before.total_solids_pct} after={result.metrics_after.total_solids_pct} />
                            </tbody>
                        </table>
                    </Section>

                    {/* Diffs */}
                    {result.diffs.length > 0 && (
                        <Section title="📋 Ingredient Changes">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <Th>Ingredient</Th><Th>Original (g)</Th><Th>Proposed (g)</Th><Th>Δ g</Th><Th>Δ %</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.diffs.map(d => (
                                        <tr key={d.ingredient}>
                                            <Td>{d.ingredient}</Td>
                                            <Td>{d.original_g.toLocaleString()}</Td>
                                            <Td>{d.proposed_g.toLocaleString()}</Td>
                                            <Td style={{ color: d.delta_g > 0 ? '#16a34a' : '#dc2626' }}>
                                                {d.delta_g > 0 ? '+' : ''}{d.delta_g.toLocaleString()}
                                            </Td>
                                            <Td style={{ color: d.delta_g > 0 ? '#16a34a' : '#dc2626' }}>
                                                {d.delta_pct > 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                    )}

                    {/* Final Recipe Output */}
                    <Section title="✅ Final Optimized Recipe">
                        <div className="bg-muted/10 border rounded-md p-1">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <Th>Ingredient</Th><Th>Final Quantity (g)</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(result.optimized_recipe || {})
                                        .filter(([_, qty]) => Number(qty) > 0.01)
                                        .sort((a, b) => Number(b[1]) - Number(a[1]))
                                        .map(([name, qty]) => (
                                            <tr key={name}>
                                                <Td>{name}</Td>
                                                <Td style={{ fontWeight: 600, color: '#16a34a' }}>
                                                    {Number(qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </Td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* AI Analysis */}
                    <Section title="🧬 Food Scientist Analysis">
                        <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                            {parseSimpleMarkdown(result.ai_analysis)}
                        </div>
                    </Section>      {/* Warnings */}
                    {result.warnings.length > 0 && (
                        <Section title="⚠️ Warnings">
                            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </Section>
                    )}
                </div>
            )}

            {/* Save Section */}
            {result && result.success && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Save className="h-4 w-4" />
                            Use Optimized Recipe
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-2">
                        {onApplyRecipe && (
                            <Button
                                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                                onClick={() => result.optimized_recipe && onApplyRecipe(result.optimized_recipe)}
                                disabled={!result.optimized_recipe}
                            >
                                <Zap className="h-4 w-4" />
                                Apply to Calculator
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className={onApplyRecipe ? "flex-1 gap-2 border-primary/20" : "flex-1 gap-2"}
                            onClick={() => handleSaveClick(true)}
                            disabled={!!saving}
                        >
                            {saving === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                            Save as New Recipe
                        </Button>
                        <Button
                            className="flex-1 gap-2"
                            onClick={() => handleSaveClick(false)}
                            disabled={!!saving || selectedRecipeId === 'default'}
                        >
                            {saving === 'update' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Update Original
                        </Button>
                    </CardContent>
                    {saveMessage && (
                        <div className={`mx-6 mb-4 px-3 py-1.5 rounded text-xs ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {saveMessage.text}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

// ── Helper sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.05rem' }}>{title}</h3>
            {children}
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th style={{
            textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e5e7eb',
            fontSize: '0.85rem', color: '#6b7280',
        }}>
            {children}
        </th>
    );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', ...style }}>
            {children}
        </td>
    );
}

function MetricRow({ label, before, after }: { label: string; before: number; after: number }) {
    return (
        <tr>
            <Td style={{ fontWeight: 600 }}>{label}</Td>
            <Td>{before.toFixed(3)}</Td>
            <Td>{after.toFixed(3)}</Td>
        </tr>
    );
}

// ── Simple Markdown Parser ──

function parseSimpleMarkdown(text: string) {
    if (!text) return null;

    // Auto-inject newlines before numbers like "1. ", "2. " if Gemini squished them into one paragraph
    const formattedText = text.replace(/([.!?])\s+(\d+\.\s+[A-Z])/g, '$1\n\n$2');

    const lines = formattedText.split('\n');
    return lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#### ')) {
            return <h4 key={idx} className="text-md font-semibold mt-4 mb-2 text-foreground">{formatBold(trimmed.slice(5))}</h4>;
        } else if (trimmed.startsWith('### ')) {
            return <h3 key={idx} className="text-lg font-semibold mt-5 mb-3 text-foreground">{formatBold(trimmed.slice(4))}</h3>;
        } else if (trimmed.startsWith('## ')) {
            return <h2 key={idx} className="text-xl font-semibold mt-6 mb-4 text-foreground">{formatBold(trimmed.slice(3))}</h2>;
        } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
            const isNumbered = /^\d+\.\s/.test(trimmed);
            const content = isNumbered ? trimmed.replace(/^\d+\.\s/, '') : trimmed.slice(2);
            return (
                <div key={idx} className="flex items-start gap-2 ml-1 mt-2 mb-2">
                    <span className="font-semibold text-primary/70 select-none mt-0.5">{isNumbered ? trimmed.match(/^\d+\./)?.[0] : '•'}</span>
                    <span className="text-foreground/80">{formatBold(content)}</span>
                </div>
            );
        } else if (trimmed === '') {
            return <div key={idx} className="h-1" />;
        } else {
            return <p key={idx} className="mb-2 text-foreground/80">{formatBold(trimmed)}</p>;
        }
    });
}

function formatBold(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}
