/**
 * AiRecipeCreator — Stage 2 React component for creating recipes from scratch.
 *
 * Mirrors AiOptimizerDemo's styling patterns (shadcn/ui cards, tables, badges).
 * Shows a 5-step progress indicator as the pipeline runs.
 */

import { useState } from 'react';
import { apiPost } from '@/lib/apiClient';
import type { Stage2AgentResult, ProductionTargets } from '@/lib/ai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertCircle, Search, Wrench, FlaskConical, Settings, Star, Save, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { recipeService } from '@/services/recipeService';
import { INGREDIENT_DB } from '@/lib/ai/ingredientDb';

import { SaveRecipeModal } from './SaveRecipeModal';

const DEFAULT_PROD_TARGETS: ProductionTargets = {
    lossPct: 5,
    mixDensity: 1.04,
    overrunPct: 27,
    skuSizeLiters: 0.75,
    targetVolumeLiters: 1000,
};

// ── Pipeline steps ──

const PIPELINE_STEPS = [
    { key: 'search', label: 'Finding Reference', icon: Search },
    { key: 'engineer', label: 'Building Recipe', icon: Wrench },
    { key: 'scientist', label: 'Reviewing Science', icon: FlaskConical },
    { key: 'optimizer', label: 'Optimizing', icon: Settings },
    { key: 'critique', label: 'Final Critique', icon: Star },
] as const;

type PipelineStep = typeof PIPELINE_STEPS[number]['key'];

export default function AiRecipeCreator() {
    const [prompt, setPrompt] = useState('');
    const [targetFat, setTargetFat] = useState('');
    const [targetMsnf, setTargetMsnf] = useState('');
    const [targetSugar, setTargetSugar] = useState('');

    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Stage2AgentResult | null>(null);

    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const fat = targetFat ? parseFloat(targetFat) : undefined;
            const msnf = targetMsnf ? parseFloat(targetMsnf) : undefined;
            const sugar = targetSugar ? parseFloat(targetSugar) : undefined;

            // Step progression is now server-side; just show loading
            setCurrentStep('search');

            const res = await apiPost<Stage2AgentResult>('/api/ai/create', {
                userPrompt: prompt,
                targetParams: {
                    fat_pct: fat ?? null,
                    msnf_pct: msnf ?? null,
                    sugars_pct: sugar ?? null,
                },
                productionTargets: DEFAULT_PROD_TARGETS,
                mode: 'gelato',
            });

            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
            setCurrentStep(null);
        }
    };

    const handleSaveClick = () => {
        setIsSaveModalOpen(true);
    };

    const handleSaveConfirm = async (name: string, type: string) => {
        if (!result || !result.optimized_recipe) return;

        setSaving(true);
        setSaveMessage(null);

        try {
            await recipeService.saveAiRecipe(
                name,
                type,
                result.optimized_recipe,
                INGREDIENT_DB
            );

            setSaveMessage({ type: 'success', text: 'Recipe saved successfully to your database!' });
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: `Failed to save: ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 w-full max-w-4xl mx-auto">
            <SaveRecipeModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveConfirm}
                initialName={prompt || 'New AI Recipe'}
            />
            {/* Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">1. Describe Your Recipe</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            placeholder="e.g. 'Make a rich chocolate gelato with roasted cocoa notes'"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Describe the recipe you want. Our AI will find a similar recipe from your database
                            (or research online) and build a new one from scratch.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">2. Target Parameters (Optional)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fat %</Label>
                            <Input placeholder="e.g. 8" value={targetFat} onChange={e => setTargetFat(e.target.value)} type="number" step="0.1" disabled={loading} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">MSNF %</Label>
                            <Input placeholder="e.g. 10" value={targetMsnf} onChange={e => setTargetMsnf(e.target.value)} type="number" step="0.1" disabled={loading} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Sugar %</Label>
                            <Input placeholder="e.g. 18" value={targetSugar} onChange={e => setTargetSugar(e.target.value)} type="number" step="0.1" disabled={loading} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Run Button */}
            <Button
                onClick={handleCreate}
                disabled={loading || !prompt.trim()}
                className="w-full gap-2"
                size="lg"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? 'Creating Recipe...' : 'Create Recipe from Scratch'}
            </Button>

            {/* Progress Indicator */}
            {loading && currentStep && (
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between gap-1">
                            {PIPELINE_STEPS.map((step) => {
                                const Icon = step.icon;
                                const isActive = step.key === currentStep;
                                const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === step.key);
                                const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
                                const isDone = stepIdx < currentIdx;

                                return (
                                    <div
                                        key={step.key}
                                        className={`flex flex-col items-center gap-1 flex-1 transition-all duration-300 ${isActive ? 'scale-110' : isDone ? 'opacity-50' : 'opacity-30'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-full ${isActive ? 'bg-primary text-primary-foreground animate-pulse' :
                                            isDone ? 'bg-green-500/20 text-green-600' :
                                                'bg-muted text-muted-foreground'
                                            }`}>
                                            {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                                        </div>
                                        <span className={`text-[10px] text-center leading-tight ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
                                            }`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Error */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    {/* Verdict Banner */}
                    <div className={`p-4 rounded-lg border-2 ${result.critique_verdict === 'approved'
                        ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800'
                        : 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant={result.critique_verdict === 'approved' ? 'default' : 'secondary'}
                                    className={result.critique_verdict === 'approved' ? 'bg-green-600' : 'bg-amber-600'}>
                                    {result.critique_verdict === 'approved' ? '✅ Approved' : '⚠️ Needs Revision'}
                                </Badge>
                                <span className="text-sm font-medium">
                                    Confidence: {result.critique_confidence}%
                                </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                Solver: {result.solver_status}
                            </span>
                        </div>
                    </div>

                    {/* Reference Recipe */}
                    <Section title="🔍 Reference Recipe">
                        {result.reference_recipe_name ? (
                            <div className="space-y-2">
                                <p className="flex items-center gap-2">
                                    <Badge variant="outline">📖 {result.reference_recipe_name}</Badge>
                                    {result.used_web_search && <Badge variant="secondary" className="text-xs">🌐 Web Search Used</Badge>}
                                </p>
                                <p className="text-sm text-muted-foreground">{result.search_reasoning}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="flex items-center gap-2">
                                    <Badge variant="secondary">No DB match</Badge>
                                    <Badge variant="secondary" className="text-xs">🌐 Web Search Used</Badge>
                                </p>
                                <p className="text-sm text-muted-foreground">{result.search_reasoning}</p>
                            </div>
                        )}
                    </Section>

                    {/* Engineer Reasoning */}
                    <Section title="🔧 Food Engineer">
                        <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                            {parseSimpleMarkdown(result.engineer_reasoning)}
                        </div>
                    </Section>

                    {/* Scientist Changes */}
                    <Section title="🧪 Food Scientist Review">
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed pt-1">
                                {result.scientist_changes}
                            </p>
                            <div className="text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/20 space-y-2 py-1">
                                {parseSimpleMarkdown(result.scientist_reasoning)}
                            </div>
                        </div>
                    </Section>

                    {/* Metrics Comparison */}
                    <Section title="📊 Metrics (Before → After Optimization)">
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
                        <Section title="📋 Optimizer Adjustments">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <Th>Ingredient</Th><Th>Before (g)</Th><Th>After (g)</Th><Th>Δ g</Th><Th>Δ %</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.diffs.map(d => (
                                        <tr key={d.ingredient}>
                                            <Td>{d.ingredient}</Td>
                                            <Td>{d.original_g.toLocaleString('en-US', { useGrouping: false })}</Td>
                                            <Td>{d.proposed_g.toLocaleString('en-US', { useGrouping: false })}</Td>
                                            <Td style={{ color: d.delta_g > 0 ? '#16a34a' : '#dc2626' }}>
                                                {d.delta_g > 0 ? '+' : ''}{d.delta_g.toLocaleString('en-US', { useGrouping: false })}
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

                    {/* Final Optimized Recipe */}
                    <Section title="✅ Final Optimized Recipe">
                        <div className="bg-muted/10 border rounded-md p-1">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <Th>Ingredient</Th><Th>Quantity (g)</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(result.optimized_recipe || {})
                                        .filter(([, qty]) => Number(qty) > 0.01)
                                        .sort((a, b) => Number(b[1]) - Number(a[1]))
                                        .map(([name, qty]) => (
                                            <tr key={name}>
                                                <Td>{name}</Td>
                                                <Td style={{ fontWeight: 600, color: '#16a34a' }}>
                                                    {Number(qty).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}
                                                </Td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Food Critique Review */}
                    <Section title="🍽️ Food Critique Review">
                        <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                            {parseSimpleMarkdown(result.critique_review)}
                        </div>
                    </Section>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                        <Section title="⚠️ Warnings">
                            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </Section>
                    )}

                    {/* Save Section */}
                    {result.success && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Save className="h-4 w-4" />
                                    Save Created Recipe
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full gap-2"
                                    onClick={handleSaveClick}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    Save to My Recipes
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
            )}
        </div>
    );
}

// ── Helper sub-components (mirrors AiOptimizerDemo) ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
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

// ── Simple Markdown Parser (reuse from AiOptimizerDemo) ──

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
