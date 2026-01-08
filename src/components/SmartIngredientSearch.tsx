import { useState, useMemo, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { Search, Clock, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { IngredientData } from "@/types/ingredients";
import { cn } from "@/lib/utils";

interface SmartIngredientSearchProps {
  ingredients: IngredientData[];
  onSelect: (ingredient: IngredientData) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const RECENT_KEY = "recentIngredients";

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5);
  } catch {
    return [];
  }
}

function addRecent(id: string) {
  const recent = getRecent().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

export function SmartIngredientSearch({ 
  ingredients, 
  onSelect, 
  open, 
  onOpenChange 
}: SmartIngredientSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js for fuzzy matching
  const fuse = useMemo(
    () =>
      new Fuse(ingredients, {
        keys: [
          { name: "name", weight: 2 },
          { name: "category", weight: 1 },
          { name: "tags", weight: 0.5 }
        ],
        threshold: 0.3,
        ignoreLocation: true,
        includeScore: true,
      }),
    [ingredients]
  );

  // Get recent ingredients
  const recentIds = useMemo(() => getRecent(), [open]);
  const recentIngredients = useMemo(
    () => ingredients.filter(i => recentIds.includes(i.id)),
    [ingredients, recentIds]
  );

  // Filter ingredients based on search query
  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) {
      return ingredients;
    }
    // Fuzzy search with Fuse.js
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [searchQuery, fuse, ingredients]);

  // Group ingredients by category
  const groupedIngredients = useMemo(() => {
    const groups: Record<string, IngredientData[]> = {};
    filteredIngredients.forEach(ing => {
      if (!groups[ing.category]) {
        groups[ing.category] = [];
      }
      groups[ing.category].push(ing);
    });
    return groups;
  }, [filteredIngredients]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      const totalItems = searchQuery ? filteredIngredients.length : recentIngredients.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const items = searchQuery ? filteredIngredients : recentIngredients;
        if (items[selectedIndex]) {
          handleSelect(items[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange?.(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedIndex, filteredIngredients, recentIngredients, searchQuery]);

  const handleSelect = (ingredient: IngredientData) => {
    addRecent(ingredient.id);
    onSelect(ingredient);
    setSearchQuery("");
    onOpenChange?.(false);
  };

  const renderIngredientItem = (ing: IngredientData, idx: number, isSelected: boolean) => (
    <div
      key={ing.id}
      className={cn(
        "flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-md transition-colors",
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      )}
      onClick={() => handleSelect(ing)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-medium truncate">{ing.name}</span>
      </div>
      <Badge variant="secondary" className="text-xs flex-shrink-0">
        {ing.category}
      </Badge>
    </div>
  );

  return (
    <div className="w-full bg-popover border rounded-lg shadow-lg z-50">
      {/* Search Input */}
      <div className="p-3 border-b bg-popover">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search ingredients... (e.g., 'lici' finds Litchi)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="pl-9 bg-background"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filteredIngredients.length} ingredient{filteredIngredients.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Results */}
      <ScrollArea className="h-[400px] bg-popover">
        <div className="p-3 space-y-4">
          {/* Recent Ingredients Section (when no search query) */}
          {!searchQuery && recentIngredients.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                  Recent
                </h4>
              </div>
              <div className="space-y-1">
                {recentIngredients.map((ing, idx) => 
                  renderIngredientItem(ing, idx, !searchQuery && selectedIndex === idx)
                )}
              </div>
            </div>
          )}

          {/* All Ingredients (grouped by category) */}
          {searchQuery ? (
            // Search results
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2 px-1">
                Search Results
              </h4>
              {filteredIngredients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ingredients found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredIngredients.map((ing, idx) => 
                    renderIngredientItem(ing, idx, selectedIndex === idx)
                  )}
                </div>
              )}
            </div>
          ) : (
            // Grouped by category (when no search)
            Object.entries(groupedIngredients).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2 px-1">
                  {category}
                </h4>
                <div className="space-y-1">
                  {items.map((ing) => {
                    const idx = ingredients.indexOf(ing);
                    return renderIngredientItem(ing, idx, false);
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t bg-popover">
        <p className="text-xs text-center text-muted-foreground">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </p>
      </div>
    </div>
  );
}
