
import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';

export interface StandardInventoryItem {
  itemId: string;
  itemName: string;
  unit: string;
  category: string;
  requiredStandard: number; // This corresponds to "In Circulation" (Calculated)
  currentTotalAssets: number;
  currentStock: number; // Added for convenience
  variance: number;
  status: 'Du' | 'Thieu' | 'Chuan';
}

export const useStandardInventory = () => {
  const { rooms, roomRecipes, services } = useAppContext();

  const standardStats = useMemo(() => {
    const requirements: Record<string, number> = {};

    // 1. Calculate Requirements based on Room Types and their Recipes
    rooms.forEach(room => {
      // Only count active rooms (not deleted/maintenance if strictly needed, but usually we count all setup rooms)
      if (!room.type) return;
      
      const recipe = roomRecipes[room.type];
      if (recipe && recipe.items) {
        recipe.items.forEach(recipeItem => {
          const currentQty = requirements[recipeItem.itemId] || 0;
          requirements[recipeItem.itemId] = currentQty + recipeItem.quantity;
        });
      }
    });

    // 2. Map to Services and Compare
    const results: StandardInventoryItem[] = services
      .filter(s => ['Linen', 'Asset', 'Minibar', 'Amenity'].includes(s.category))
      .map(service => {
        const standardQty = requirements[service.id] || 0; // This is the Calculated In Circulation
        
        // Calculate Actual Assets
        // For Assets/Linen: We often use totalassets field for "Book Value".
        // For Consumables: We might not track totalassets strictly.
        // But per new requirement: Total Real = Calculated In Room + Stock.
        
        const stock = service.stock || 0;
        
        // Note: This 'actualAssets' logic here is for the "Settings > Analysis" table.
        // For the main Inventory table, we will calculate explicitly as (Standard + Stock).
        // Here we keep the logic consistent with "Assets owned vs Assets needed".
        
        let actualAssets = service.totalassets || 0;
        if (actualAssets === 0) {
             // Fallback if totalassets is not set
             actualAssets = stock + (service.in_circulation || 0) + (service.laundryStock || 0) + (service.vendor_stock || 0);
        }

        const diff = actualAssets - standardQty;

        return {
          itemId: service.id,
          itemName: service.name,
          unit: service.unit,
          category: service.category,
          requiredStandard: standardQty,
          currentTotalAssets: actualAssets,
          currentStock: stock,
          variance: diff,
          status: diff === 0 ? 'Chuan' : diff > 0 ? 'Du' : 'Thieu'
        };
      });

    // Sort: Missing items first (ascending variance), then Surplus
    return results.sort((a, b) => a.variance - b.variance);

  }, [rooms, roomRecipes, services]);

  return standardStats;
};
