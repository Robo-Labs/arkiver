import { LRUCache } from "lru-cache";

export class Store extends LRUCache<any, any> {
  constructor(options: LRUCache.Options<any, any, unknown>) {
    super(options);
  }

  retrieve<TValue>(
    key: string,
    defaultValueAccessor: () => TValue | Promise<TValue>
  ): TValue | Promise<TValue> {
    const value = super.get(key) as TValue | Promise<TValue>;
    if (value) {
      return value;
    }

    const defaultValue = defaultValueAccessor();

    super.set(key, defaultValue);

    return defaultValue;
  }
}
