
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authService } from "@/lib/auth/authService";

interface SaveRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, type: string, tags: string[]) => Promise<void>;
    initialName?: string;
    initialType?: string;
    initialTags?: string[];
    isUpdate?: boolean; // If true, UI reflects "Update" instead of "Create"
}

export function SaveRecipeModal({
    isOpen,
    onClose,
    onSave,
    initialName = '',
    initialType = 'gelato',
    initialTags = [],
    isUpdate = false
}: SaveRecipeModalProps) {
    const [name, setName] = useState(initialName);
    const [type, setType] = useState(initialType);
    const [tagsText, setTagsText] = useState(initialTags.join(', '));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check auth on open (optional, mostly relies on parent to show/hide, but good for UX safety)
    // Logic: The modal assumes it's only shown if logged in, or parent handles auth flow.
    // But we can double check here before saving.

    const handleSave = async () => {
        setError(null);
        if (!name.trim()) {
            setError("Recipe name is required");
            return;
        }

        setIsLoading(true);
        try {
            const user = await authService.getUser();
            if (!user) {
                setError("You must be logged in to save.");
                setIsLoading(false);
                return;
            }

            const tagsArray = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
            await onSave(name, type, tagsArray);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to save recipe");
        } finally {
            setIsLoading(false);
        }
    };

    // Reset state when opening (effect not needed if key changes or controlled fully prop-wise, 
    // but setting initial state on mount/change is good)
   React.useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setType(initialType);
            setTagsText(initialTags.join(', '));
            setError(null);
        }
    }, [isOpen, initialName, initialType, initialTags]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isUpdate ? "Update Recipe" : "Save Recipe"}</DialogTitle>
                    <DialogDescription>
                        {isUpdate
                            ? "Update your existing recipe. This will overwrite previous data."
                            : "Save this recipe to your personal library."}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                           Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g., Pistachio Gelato v1"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                           Type
                        </Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gelato">Gelato</SelectItem>
                                <SelectItem value="ice_cream">Ice Cream</SelectItem>
                                <SelectItem value="sorbet">Sorbet</SelectItem>
                                <SelectItem value="sherbet">Sherbet</SelectItem>
                                <SelectItem value="kulfi">Kulfi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tags" className="text-right">
                           Tags
                        </Label>
                        <div className="col-span-3 space-y-1">
                            <Input
                                id="tags"
                                value={tagsText}
                                onChange={(e) => setTagsText(e.target.value)}
                                placeholder="e.g., vegan, test, summer"
                            />
                            <p className="text-[10px] text-muted-foreground">Comma-separated list of tags</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="text-sm text-red-500 mb-4 text-center">{error}</div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                       Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
