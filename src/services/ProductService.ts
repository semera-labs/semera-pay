import AsyncStorage from '@react-native-async-storage/async-storage';
import { BISTRO_CONFIG } from '../constants/config';

export interface Product {
  id: string;
  catId: string;
  name: string;
  price: number;         // in Cent
  withDeposit?: boolean; // Pfand wird automatisch mit hinzugefügt
}

class ProductService {
  private STORAGE_KEY = '@semera_pay_products';

  // Standard-Produkte aus der Konfiguration
  defaults(): Product[] {
    return BISTRO_CONFIG.products as Product[];
  }

  // Gespeicherte Produkte; solange noch nichts angepasst wurde, die Standard-Produkte
  async getProducts(): Promise<Product[]> {
    const data = await AsyncStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : this.defaults();
  }

  saveProducts(products: Product[]): Promise<void> {
    return AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
  }

  // Zurück zu den Standard-Produkten
  resetToDefaults(): Promise<void> {
    return AsyncStorage.removeItem(this.STORAGE_KEY);
  }
}

export default new ProductService();
