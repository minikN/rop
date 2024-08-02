// SOURCE: https://github.com/MathisBullinger/froebel/blob/main/pipe.ts

export type λ<TA extends any[] = any[], TR = any> = (...args: TA) => TR;
export type MakeProm<T> = Promise<T extends PromiseLike<infer I> ? I : T>;

const isPromise = <T = any>(value: unknown): value is Promise<T> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as any).then === "function";

/**
 * Given a list of functions returns a function that will execute the given
 * functions one after another, always passing the result of the previous
 * function as an argument to the next function.
 *
 * If one of the given functions returns a promise, the promise will be resolved
 * before being passed to the next function.
 *
 * @example
 * ```
 * const join = (...chars: string[]) => chars.join('')
 * pipe(join, parseInt)('1', '2', '3')  // -> 123
 *
 * const square = (n: number) => n ** 2
 *
 * // this is equivalent to: square(square(square(2)))
 * pipe(square, square, square)(2)  // -> 256
 *
 * // also works with promises:
 * fetchNumber :: async () => Promise<number>
 * pipe(fetchNumber, n => n.toString())  // async () => Promise<string>
 * ```
 */
export const pipe = <T extends [λ, ...λ[]]>(
  ...funs: PipeReturn<T> extends never ? never : T
) =>
  ((...args) => {
    let nextArgs: unknown[] = args;

    for (let i = 0; i < funs.length; i++) {
      const [result] = nextArgs = [funs[i](...nextArgs)];
      if (isPromise(result)) return resolveAsync(result, funs.slice(i + 1));
    }

    return nextArgs[0];
  }) as PipedFun<T>;

export default pipe;

export const mappedPipe = (
  mapFn: (next: Function) => (...x: unknown[]) => unknown
) =>
 <T extends [λ, ...λ[]]>(...funs) => ((...args) => {
    let nextArgs: unknown[] = args;

    for (let i = 0; i < funs.length; i++) {
    const [result] = nextArgs = [i > 0 ? mapFn(funs[i])(...nextArgs) : funs[i](...nextArgs)];
    if (isPromise(result)) return resolveAsync(result, funs.slice(i + 1));
    }

    return nextArgs[0];
}) as PipedFun<T>;


const resolveAsync = async (result: unknown, funs: λ[]) => {
  for (const fun of funs) result = fun(await result);
  return await result;
};

type PipedFun<T extends λ[]> = PipeReturn<T> extends never ? never
  : ((...args: Parameters<T[0]>) => PipeReturn<T>);

type PipeReturn<F extends λ[]> = CheckPipe<
  F,
  CarryReturn<ReturnTypes<F>, Parameters<F[0]>>
>;

type FunDef = [Return: any, Args: any[]];

type CheckPipe<
  F extends λ[],
  D extends FunDef[],
  Async extends boolean = false,
> = F extends [any, any, ...any[]]
  ? (Resolved<D[0][1]> extends Parameters<F[0]> ? CheckPipe<
      F extends [any, ...infer F_] ? (F_ extends λ[] ? F_ : never) : never,
      D extends [any, ...infer D_] ? (D_ extends FunDef[] ? D_ : never)
        : never,
      Async extends true ? true
        : ReturnType<F[0]> extends Promise<unknown> ? true
        : false
    >
    : never)
  : Resolved<D[0][1]> extends Parameters<F[0]>
    ? (Async extends true ? MakeProm<ReturnType<F[0]>> : ReturnType<F[0]>)
  : never;

type Resolved<T extends unknown> = {
  [K in keyof T]: T[K] extends Promise<infer I> ? I : T[K];
};

type ReturnTypes<T extends λ[]> = {
  [K in keyof T]: ReturnType<T[K]>;
};

type CarryReturn<Returns extends any[], Args extends any[]> = Returns extends
  [infer A, ...infer B] ? [[A, Args], ...CarryReturn<B, [A]>]
  : [];