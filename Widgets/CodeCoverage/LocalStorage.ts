export interface IStorageItem {
  key: string;
  value: any;
}

export class StorageItem {
  public key: string;
  public value: any;

  constructor(data: IStorageItem) {
    this.key = data.key;
    this.value = data.value;
  }
}

// class for working with local storage in browser (common that can use other classes for store some data)
export class LocalStorageManager {
  private localStorageSupported: boolean;

  constructor() {
    this.localStorageSupported = typeof window['localStorage'] !== undefined && window['localStorage'] !== null;
  }

  // add value to storage
  public add(key: string, item: string) {
    if (this.localStorageSupported) {
      localStorage.setItem(key, item);
    }
  }

  // add value to storage
  public addValue<TValue>(key: string, item: TValue) {
    if (this.localStorageSupported) {
      localStorage.setItem(key, JSON.stringify(item));
    }
  }

  // get all values from storage (all items)
  public getAllItems(): Array<StorageItem> {
    const list = new Array<StorageItem>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      list.push(
        new StorageItem({
          key: key,
          value: value,
        })
      );
    }
    return list;
  }

  // get only all values from localStorage
  public getAllValues(): Array<any> {
    const list = new Array<any>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      list.push(value);
    }
    return list;
  }

  // get one item by key from storage
  public get(key: string): string {
    return this.localStorageSupported ? localStorage.getItem(key) : null;
  }

  // get one item by key from storage
  public getValue<TValue>(key: string): TValue {
    const stringVal = this.localStorageSupported ? localStorage.getItem(key) : '';
    return JSON.parse(stringVal) as TValue;
  }

  // remove value from storage
  public remove(key: string) {
    if (this.localStorageSupported) {
      localStorage.removeItem(key);
    }
  }

  // clear storage (remove all items from it)
  public clear() {
    if (this.localStorageSupported) {
      localStorage.clear();
    }
  }
}
