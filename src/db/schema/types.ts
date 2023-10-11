export type Nullify<T extends string> = `${T}?`;
export type Arrayify<T extends string> = `${T}[]`;
export type ApplyModifiers<T extends string> = Nullify<T> | Arrayify<T> | T;

export type RefBase = `@${string}:${"string" | "id"}`;
export type Ref = Nullify<RefBase> | RefBase;

export type BackRef = `[]@${string}`;

export type ScalarBase = "string" | "number" | "boolean" | "bigint" | "date";
export type Scalar = Arrayify<ScalarBase> | Nullify<ScalarBase> | ScalarBase;

export type ArkiveColumns = Scalar | Ref | BackRef;

export type ArkiveSchema = Record<string, ArkiveColumns> & {
  id?: "string";
};

export type CheckNull<TName extends string> = TName extends `${string}?`
  ? true
  : false;

export type CheckArray<TName extends string> = TName extends `${string}[]`
  ? true
  : false;

export type CheckId<TName extends string> = TName extends `id` ? true : false;