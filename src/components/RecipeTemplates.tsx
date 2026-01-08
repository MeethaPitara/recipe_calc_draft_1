import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChefHat, Sparkles, IceCream } from 'lucide-react';
import type { IngredientData } from '@/types/ingredients';

interface RecipeTemplate {
  name: string;
  description: string;
  mode: 'gelato' | 'kulfi';
  icon: React.ReactNode;
  ingredients: Array<{
    tag: string;
    grams: number;
  }>;
}

const TEMPLATES: RecipeTemplate[] = [
  // === GELATO (Italian Style - Lower Fat, 6-8% fat) ===
  {
    name: 'Classic Fior di Latte',
    description: 'Pure milk gelato base - Italian foundation',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 650 },
      { tag: 'id:heavy_cream', grams: 180 },
      { tag: 'id:smp', grams: 40 },
      { tag: 'id:sucrose', grams: 145 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Madagascar Vanilla Gelato',
    description: 'Premium vanilla bean gelato',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 640 },
      { tag: 'id:heavy_cream', grams: 190 },
      { tag: 'id:smp', grams: 35 },
      { tag: 'id:sucrose', grams: 140 },
      { tag: 'id:dextrose', grams: 22 },
      { tag: 'id:vanilla_extract', grams: 8 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Dark Chocolate Gelato',
    description: 'Intense 70% cocoa gelato',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 600 },
      { tag: 'id:heavy_cream', grams: 200 },
      { tag: 'id:smp', grams: 35 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 25 },
      { tag: 'id:cocoa_powder', grams: 35 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Sicilian Pistachio Gelato',
    description: 'Authentic Bronte pistachio gelato',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 610 },
      { tag: 'id:heavy_cream', grams: 200 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:pistachio_paste', grams: 60 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Hazelnut Gelato (Nocciola)',
    description: 'Piedmont hazelnut gelato',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 600 },
      { tag: 'id:heavy_cream', grams: 210 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 128 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:hazelnut_paste', grams: 62 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Stracciatella Gelato',
    description: 'Fior di latte with chocolate ribbons',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 630 },
      { tag: 'id:heavy_cream', grams: 190 },
      { tag: 'id:smp', grams: 38 },
      { tag: 'id:sucrose', grams: 138 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:dark_chocolate', grams: 45 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Espresso Coffee Gelato',
    description: 'Italian espresso gelato',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 640 },
      { tag: 'id:heavy_cream', grams: 185 },
      { tag: 'id:smp', grams: 38 },
      { tag: 'id:sucrose', grams: 142 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:coffee_extract', grams: 25 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Tiramisu Gelato',
    description: 'Coffee mascarpone gelato',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 580 },
      { tag: 'id:heavy_cream', grams: 180 },
      { tag: 'id:mascarpone', grams: 80 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:coffee_extract', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Amarena Cherry Gelato',
    description: 'Sweet cream with Amarena cherries',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 600 },
      { tag: 'id:heavy_cream', grams: 190 },
      { tag: 'id:smp', grams: 35 },
      { tag: 'id:sucrose', grams: 125 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:cherry_puree', grams: 80 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Gianduja Gelato',
    description: 'Chocolate hazelnut gelato',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 590 },
      { tag: 'id:heavy_cream', grams: 200 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 22 },
      { tag: 'id:cocoa_powder', grams: 20 },
      { tag: 'id:hazelnut_paste', grams: 40 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Bacio Gelato',
    description: 'Chocolate hazelnut with whole hazelnuts',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 580 },
      { tag: 'id:heavy_cream', grams: 210 },
      { tag: 'id:smp', grams: 32 },
      { tag: 'id:sucrose', grams: 128 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:cocoa_powder', grams: 22 },
      { tag: 'id:hazelnut_paste', grams: 35 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Crema Gelato',
    description: 'Traditional egg custard gelato',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 610 },
      { tag: 'id:heavy_cream', grams: 180 },
      { tag: 'id:egg_yolk', grams: 60 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 138 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Zabaione Gelato',
    description: 'Marsala wine custard gelato',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 590 },
      { tag: 'id:heavy_cream', grams: 180 },
      { tag: 'id:egg_yolk', grams: 70 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 140 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:marsala_wine', grams: 25 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Ricotta & Fig Gelato',
    description: 'Fresh ricotta with fig swirl',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 550 },
      { tag: 'id:heavy_cream', grams: 170 },
      { tag: 'id:ricotta', grams: 120 },
      { tag: 'id:smp', grams: 25 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:fig_preserve', grams: 35 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Panna Cotta Gelato',
    description: 'Creamy vanilla gelato with caramel',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 620 },
      { tag: 'id:heavy_cream', grams: 200 },
      { tag: 'id:smp', grams: 35 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:vanilla_extract', grams: 10 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },

  // === ICE CREAM (American Style - Rich & Creamy, 12-16% fat) ===
  {
    name: 'French Vanilla Ice Cream',
    description: 'Rich custard-based vanilla',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 480 },
      { tag: 'id:heavy_cream', grams: 350 },
      { tag: 'id:egg_yolk', grams: 60 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:vanilla_extract', grams: 12 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Philadelphia Vanilla',
    description: 'Classic American vanilla, no eggs',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 500 },
      { tag: 'id:heavy_cream', grams: 380 },
      { tag: 'id:smp', grams: 32 },
      { tag: 'id:sucrose', grams: 140 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:vanilla_extract', grams: 10 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Triple Chocolate Ice Cream',
    description: 'Dark chocolate with chunks & chips',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 460 },
      { tag: 'id:heavy_cream', grams: 360 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 138 },
      { tag: 'id:dextrose', grams: 22 },
      { tag: 'id:cocoa_powder', grams: 45 },
      { tag: 'id:dark_chocolate', grams: 50 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Strawberry Cheesecake',
    description: 'Strawberry ice cream with cheesecake swirl',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 420 },
      { tag: 'id:heavy_cream', grams: 330 },
      { tag: 'id:cream_cheese', grams: 60 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 125 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'category:fruit', grams: 140 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Cookies & Cream',
    description: 'Vanilla with crushed cookie pieces',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 480 },
      { tag: 'id:heavy_cream', grams: 350 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 132 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:vanilla_extract', grams: 8 },
      { tag: 'id:cookie_crumbs', grams: 70 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Mint Chocolate Chip',
    description: 'Fresh mint with dark chocolate chips',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 470 },
      { tag: 'id:heavy_cream', grams: 360 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:mint_extract', grams: 10 },
      { tag: 'id:dark_chocolate', grams: 50 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Butter Pecan Ice Cream',
    description: 'Buttery ice cream with toasted pecans',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 470 },
      { tag: 'id:heavy_cream', grams: 350 },
      { tag: 'id:butter', grams: 30 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 135 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:pecan_pieces', grams: 60 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Salted Caramel Ice Cream',
    description: 'Rich caramel with sea salt',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 460 },
      { tag: 'id:heavy_cream', grams: 360 },
      { tag: 'id:smp', grams: 30 },
      { tag: 'id:sucrose', grams: 120 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:caramel_sauce', grams: 80 },
      { tag: 'id:sea_salt', grams: 2 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Rocky Road Ice Cream',
    description: 'Chocolate with marshmallows & almonds',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 450 },
      { tag: 'id:heavy_cream', grams: 340 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 20 },
      { tag: 'id:cocoa_powder', grams: 35 },
      { tag: 'id:marshmallow', grams: 50 },
      { tag: 'id:almond_pieces', grams: 40 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Bourbon Vanilla Bean',
    description: 'Madagascar vanilla with bourbon',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 470 },
      { tag: 'id:heavy_cream', grams: 360 },
      { tag: 'id:egg_yolk', grams: 50 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 138 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:vanilla_bean', grams: 12 },
      { tag: 'id:bourbon', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Peanut Butter Cup',
    description: 'Peanut butter with chocolate chunks',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 450 },
      { tag: 'id:heavy_cream', grams: 330 },
      { tag: 'id:peanut_butter', grams: 80 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:chocolate_chunks', grams: 55 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Maple Walnut Ice Cream',
    description: 'Pure maple with toasted walnuts',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 460 },
      { tag: 'id:heavy_cream', grams: 350 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 110 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:maple_syrup', grams: 70 },
      { tag: 'id:walnut_pieces', grams: 55 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Pistachio Cardamom',
    description: 'Roasted pistachio with cardamom spice',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 460 },
      { tag: 'id:heavy_cream', grams: 340 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 128 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:pistachio_paste', grams: 70 },
      { tag: 'id:cardamom', grams: 3 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Banana Foster Ice Cream',
    description: 'Caramelized banana with rum',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 450 },
      { tag: 'id:heavy_cream', grams: 340 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 125 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:banana_puree', grams: 100 },
      { tag: 'id:caramel', grams: 30 },
      { tag: 'id:rum', grams: 12 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Brown Butter Pecan',
    description: 'Browned butter with candied pecans',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:milk_3', grams: 460 },
      { tag: 'id:heavy_cream', grams: 350 },
      { tag: 'id:brown_butter', grams: 40 },
      { tag: 'id:smp', grams: 28 },
      { tag: 'id:sucrose', grams: 130 },
      { tag: 'id:dextrose', grams: 18 },
      { tag: 'id:pecan_pieces', grams: 65 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },

  // === SORBET (Dairy-Free, 24% sweetness, 270 PAC) ===
  {
    name: 'Sicilian Lemon Sorbet',
    description: 'Fresh lemon sorbet with zest',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 620 },
      { tag: 'id:sucrose', grams: 195 },
      { tag: 'id:dextrose', grams: 45 },
      { tag: 'id:lemon_juice', grams: 120 },
      { tag: 'id:lemon_zest', grams: 8 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Wild Strawberry Sorbet',
    description: 'Intense strawberry sorbet',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 440 },
      { tag: 'id:sucrose', grams: 180 },
      { tag: 'id:dextrose', grams: 38 },
      { tag: 'category:fruit', grams: 320 },
      { tag: 'id:lemon_juice', grams: 12 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Alphonso Mango Sorbet',
    description: 'Premium Indian mango sorbet',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 410 },
      { tag: 'id:sucrose', grams: 175 },
      { tag: 'id:dextrose', grams: 38 },
      { tag: 'id:mango_puree', grams: 350 },
      { tag: 'id:lemon_juice', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Raspberry Sorbet',
    description: 'Tart fresh raspberry sorbet',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 430 },
      { tag: 'id:sucrose', grams: 182 },
      { tag: 'id:dextrose', grams: 40 },
      { tag: 'id:raspberry_puree', grams: 320 },
      { tag: 'id:lemon_juice', grams: 18 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Blood Orange Sorbet',
    description: 'Sicilian blood orange sorbet',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 480 },
      { tag: 'id:sucrose', grams: 188 },
      { tag: 'id:dextrose', grams: 42 },
      { tag: 'id:orange_juice', grams: 270 },
      { tag: 'id:orange_zest', grams: 8 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Passion Fruit Sorbet',
    description: 'Tropical passion fruit sorbet',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 500 },
      { tag: 'id:sucrose', grams: 190 },
      { tag: 'id:dextrose', grams: 42 },
      { tag: 'id:passion_fruit_puree', grams: 250 },
      { tag: 'id:lemon_juice', grams: 10 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Blackberry Sorbet',
    description: 'Wild blackberry sorbet',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 440 },
      { tag: 'id:sucrose', grams: 180 },
      { tag: 'id:dextrose', grams: 40 },
      { tag: 'id:blackberry_puree', grams: 310 },
      { tag: 'id:lemon_juice', grams: 20 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Yuzu Citrus Sorbet',
    description: 'Japanese yuzu sorbet',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 600 },
      { tag: 'id:sucrose', grams: 192 },
      { tag: 'id:dextrose', grams: 45 },
      { tag: 'id:yuzu_juice', grams: 140 },
      { tag: 'id:lime_zest', grams: 5 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Pineapple Basil Sorbet',
    description: 'Tropical pineapple with fresh basil',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 420 },
      { tag: 'id:sucrose', grams: 178 },
      { tag: 'id:dextrose', grams: 38 },
      { tag: 'id:pineapple_puree', grams: 340 },
      { tag: 'id:basil', grams: 12 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Concord Grape Sorbet',
    description: 'Intense grape sorbet',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 450 },
      { tag: 'id:sucrose', grams: 185 },
      { tag: 'id:dextrose', grams: 40 },
      { tag: 'id:grape_juice', grams: 300 },
      { tag: 'id:lemon_juice', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Pomegranate Sorbet',
    description: 'Antioxidant-rich pomegranate',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 470 },
      { tag: 'id:sucrose', grams: 188 },
      { tag: 'id:dextrose', grams: 42 },
      { tag: 'id:pomegranate_juice', grams: 280 },
      { tag: 'id:lemon_juice', grams: 12 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Green Apple Sorbet',
    description: 'Tart Granny Smith apple',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 460 },
      { tag: 'id:sucrose', grams: 185 },
      { tag: 'id:dextrose', grams: 40 },
      { tag: 'id:apple_juice', grams: 290 },
      { tag: 'id:lemon_juice', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Watermelon Mint Sorbet',
    description: 'Refreshing watermelon with mint',
    mode: 'gelato',
    icon: <Sparkles className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 420 },
      { tag: 'id:sucrose', grams: 180 },
      { tag: 'id:dextrose', grams: 38 },
      { tag: 'id:watermelon_juice', grams: 340 },
      { tag: 'id:mint_leaves', grams: 10 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Peach Bellini Sorbet',
    description: 'White peach with prosecco',
    mode: 'gelato',
    icon: <IceCream className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 410 },
      { tag: 'id:sucrose', grams: 175 },
      { tag: 'id:dextrose', grams: 38 },
      { tag: 'id:peach_puree', grams: 330 },
      { tag: 'id:prosecco', grams: 30 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  },
  {
    name: 'Dark Cherry Sorbet',
    description: 'Intense Bing cherry sorbet',
    mode: 'gelato',
    icon: <ChefHat className="h-5 w-5" />,
    ingredients: [
      { tag: 'id:water', grams: 440 },
      { tag: 'id:sucrose', grams: 182 },
      { tag: 'id:dextrose', grams: 40 },
      { tag: 'id:cherry_puree', grams: 315 },
      { tag: 'id:lemon_juice', grams: 15 },
      { tag: 'id:stabilizer', grams: 3 }
    ]
  }
];

interface RecipeTemplatesProps {
  onSelectTemplate: (template: RecipeTemplate) => void;
  onStartFromScratch: () => void;
  availableIngredients: IngredientData[];
}

export function RecipeTemplates({ onSelectTemplate, onStartFromScratch, availableIngredients }: RecipeTemplatesProps) {
  return (
    <Card className="border-dashed border-2 transition-all duration-200 ease-in-out">
      <CardHeader className="text-center p-6">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-200 ease-in-out">
            <ChefHat className="h-12 w-12 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Start Your Gelato Formula</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          Choose a template to get started, or build your own recipe from scratch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <Card
              key={template.name}
              className="cursor-pointer hover:border-primary transition-all duration-200 ease-in-out hover:shadow-elegant p-4"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  {template.icon}
                  {template.name}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Button variant="outline" size="sm" className="w-full transition-all duration-200 ease-in-out">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <Button 
          variant="default" 
          size="lg" 
          className="w-full transition-all duration-200 ease-in-out"
          onClick={onStartFromScratch}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Start from Scratch
        </Button>
      </CardContent>
    </Card>
  );
}

export function resolveTemplateIngredients(
  template: RecipeTemplate,
  availableIngredients: IngredientData[]
): Array<{ ingredientId: string; grams: number }> {
  return template.ingredients
    .map(({ tag, grams }) => {
      // Try to find by tag first (exact match in tags array)
      let ingredient = availableIngredients.find(ing => 
        ing.tags?.includes(tag)
      );
      
      // If tag starts with 'id:', try to match against ingredient ID or tags
      if (!ingredient && tag.startsWith('id:')) {
        const idValue = tag.replace('id:', '');
        ingredient = availableIngredients.find(ing => 
          ing.id === idValue || ing.tags?.includes(tag)
        );
      }
      
      // Fallback to category match
      if (!ingredient && tag.startsWith('category:')) {
        const category = tag.replace('category:', '');
        ingredient = availableIngredients.find(ing => ing.category === category);
      }
      
      // Last resort: try to match by name (case-insensitive)
      if (!ingredient) {
        const searchName = tag.replace('id:', '').replace('_', ' ').toLowerCase();
        ingredient = availableIngredients.find(ing => 
          ing.name.toLowerCase().includes(searchName) ||
          searchName.includes(ing.name.toLowerCase())
        );
      }
      
      return ingredient ? { ingredientId: ingredient.id, grams } : null;
    })
    .filter((item): item is { ingredientId: string; grams: number } => item !== null);
}
