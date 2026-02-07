
import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';

export interface StandardInventoryItem {
  itemId: string;
  itemName: string;
  unit: string;
  category: string;
  requiredStandard: number;
  currentTotalAssets: number;
  variance: number;
  status: 'Du' | 'Thieu' | 'Chuan';
}

export const useStandardInventory = () => {
  const { rooms, roomRecipes, services } = useAppContext();

  const standardStats = useMemo(() => {
    const requirements: Record<string, number> = {};

    // 1. Calculate Requirements based on Room Types and their Recipes
    rooms.forEach(room => {
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
        const standardQty = requirements[service.id] || 0;
        
        // Calculate Actual Assets
        // Priority: totalassets field (Fixed Assets).
        // Fallback: Sum of all stock locations (Consumables/Dynamic).
        let actualAssets = service.totalassets || 0;
        if (actualAssets === 0) {
             actualAssets = (service.stock || 0) + (service.in_circulation || 0) + (service.laundryStock || 0) + (service.vendor_stock || 0);
        }

        const diff = actualAssets - standardQty;

        return {
          itemId: service.id,
          itemName: service.name,
          unit: service.unit,
          category: service.category,
          requiredStandard: standardQty,
          currentTotalAssets: actualAssets,
          variance: diff,
          status: diff === 0 ? 'Chuan' : diff > 0 ? 'Du' : 'Thieu'
        };
      });

    // Sort: Missing items first (ascending variance), then Surplus
    return results.sort((a, b) => a.variance - b.variance);

  }, [rooms, roomRecipes, services]);

  return standardStats;
};
