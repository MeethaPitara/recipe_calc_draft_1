
import React, { useState, useEffect } from 'react';
import { useBasePlannerStore } from '@/store/useBasePlannerStore';
import { authService } from '@/lib/auth/authService';
import { useToast } from '@/hooks/use-toast';
import { savePlanL2, getPlansL2, deletePlanL2, PlanL2 } from '@/lib/api/plans_l2';

// Icons
import { Save, History, Trash2, Loader2, ArrowLeft } from 'lucide-react';

// Components
import { AvailableRecipesPanel } from '@/components/production/base-planner/AvailableRecipesPanel';
import { ProductionPlanPanel } from '@/components/production/base-planner/ProductionPlanPanel';
import { ProductionSummary } from '@/components/production/base-planner/ProductionSummary';
import { TopStatsBar } from '@/components/production/base-planner/TopStatsBar';
import { Button } from '@/components/ui/button';
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
   SheetTrigger,
} from "@/components/ui/sheet";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from 'react-router-dom';

const BasePlanner = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const {
        reset,
        baseIngredientId,
        totalBaseMassKg,
        rows,
        engineOutput,
        setBaseIngredientId,
        setTotalBaseMassKg,
        loadState
    } = useBasePlannerStore();

    // -- State: Save/Load --
    const [isSaving, setIsSaving] = useState(false);
    const [planName, setPlanName] = useState("");
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [savedPlans, setSavedPlans] = useState<PlanL2[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => reset();
    }, [reset]);

    const handleSavePlan = async () => {
        if (!engineOutput || !planName.trim()) return;

        setIsSaving(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) throw new Error("No user email found");

            const supplyParams = {
                baseIngredientId,
                totalAvailableMassKg: totalBaseMassKg
            };

            // We store the rows as 'allocations_snapshot'
            // We store the engine output as 'results_snapshot'
            await savePlanL2({
                user_email: user.email,
                plan_name: planName,
                supply_params: supplyParams as any,
                allocations_snapshot: rows as any,
                results_snapshot: engineOutput as any
            });

            toast({
                title: "Plan Saved",
                description: `"${planName}" has been saved to your history.`,
            });
            setIsSaveDialogOpen(false);
            setPlanName("");
        } catch (error: any) {
            toast({
                title: "Error saving plan",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const loadHistory = async () => {
        if (!isHistoryOpen) return;

        setIsLoadingPlans(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) return;

            const plans = await getPlansL2(user.email);
            setSavedPlans(plans || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingPlans(false);
        }
    };

    useEffect(() => {
        if (isHistoryOpen) {
            loadHistory();
        }
    }, [isHistoryOpen]);

    const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deletePlanL2(id);
            setSavedPlans(prev => prev.filter(p => p.id !== id));
            toast({ title: "Plan deleted" });
        } catch (error) {
            toast({ title: "Failed to delete", variant: "destructive" });
        }
    }

    const loadPlanIntoState = (plan: PlanL2) => {
        const supply = plan.supply_params as any;
        const allocations = plan.allocations_snapshot as any[];

        loadState(supply.baseIngredientId, supply.totalAvailableMassKg, allocations);

        toast({ title: "Plan Loaded", description: `Restored "${plan.plan_name}"` });
        setIsHistoryOpen(false);
    };

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-[1600px] animate-in fade-in duration-500 bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">

            {/* Header / Top Stats / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Base Allocator</h1>
                        <p className="text-sm text-muted-foreground">Level-2 Production</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* SAVE DIALOG */}
                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={!engineOutput} variant="outline" className="gap-2">
                                <Save className="h-4 w-4" />
                               Save Plan
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Allocation Plan</DialogTitle>
                                <DialogDescription>
                                   Save this base allocation scenario for later.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Plan Name</Label>
                                    <Input
                                        placeholder="e.g. 50kg White Base Split"
                                        value={planName}
                                        onChange={e => setPlanName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSavePlan} disabled={isSaving || !planName.trim()}>
                                    {isSaving ? "Saving..." : "Save Plan"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* HISTORY SHEET */}
                    <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <History className="h-4 w-4" />
                               History
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Saved Allocations</SheetTitle>
                                <SheetDescription>
                                   Previous Level-2 plans.
                                </SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
                                {isLoadingPlans ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                                ) : savedPlans.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">No saved plans yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {savedPlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                                                onClick={() => loadPlanIntoState(plan)}
                                            >
                                                <div className="space-y-1">
                                                    <p className="font-medium leading-none">{plan.plan_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(plan.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"
                                                    onClick={(e) => handleDeletePlan(plan.id, e)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            <div className="space-y-4">
                <TopStatsBar />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start h-full">

                {/* --- Left Panel: Available Recipes (Zone 1) --- */}
                {/* Renamed "Zone 1" in PRD is basically the supply header, which TopStatsBar covers, 
                    and then Zone 2 is the demand grid.
                   The "AvailableRecipesPanel" acts as the tool to ADD to the demand grid. 
                */}
                <div className="xl:col-span-4 h-full">
                    <AvailableRecipesPanel />
                </div>

                {/* --- Right Panel: Production Plan (Zone 2) --- */}
                <div className="xl:col-span-8 h-full">
                    <ProductionPlanPanel />
                </div>
            </div>

            {/* --- Bottom Panel: Procurement List (Zone 3) --- */}
            <div className="w-full">
                <ProductionSummary />
            </div>
        </div>
    );
};

export default BasePlanner;
