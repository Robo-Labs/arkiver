export type ValueOf<T> = T[keyof T];
export type Entries<Obj> = ValueOf<{
  [Key in keyof Obj]: [Key, Obj[Key]];
}>;
export type FromEntries<Entries extends [any, any]> = {
  [Entry in Entries as Entry[0]]: Entry[1];
};

export type OmitByValue<T, Omitted> = FromEntries<
  Exclude<Entries<T>, [any, Omitted]>
>;

export type PickByValue<T, Picked> = FromEntries<
  Extract<Entries<T>, [any, Picked]>
>;

export type Prettify<T> =
  | {
      [Key in keyof T]: T[Key];
    }
  | never;
