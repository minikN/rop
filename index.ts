import { pipe, asyncPipe } from './util/pipe'
import { realpath } from 'node:fs/promises'

// ---------------------------------
// Holy bible: https://github.com/swlaschin/RailwayOrientedProgramming/blob/master/Railway_Oriented_Programming_Slideshare.pdf
// ---------------------------------

// List of possible error types
type ErrorTypes =
  | 'NO_USER_NAME'
  | 'NO_USER_EMAIL'
  | 'USER_TOO_YOUNG'
  | 'USER_NO_VALID_NAME'
  | 'NO_PATH_GIVEN'
  | 'INVALID_PATH_GIVEN'
  | 'ERR_INVALID_ARG_TYPE'
  | 'ENOENT'

// Message for each error type
const ErrorMessages = Object.freeze({
  NO_USER_NAME: 'No user name given: %d',
  NO_USER_EMAIL: 'No email given: %d',
  USER_TOO_YOUNG: 'User too young: %d',
  USER_NO_VALID_NAME: 'Not a valid name',
  NO_PATH_GIVEN: 'Not a valid name',
  INVALID_PATH_GIVEN: 'Not a valid name',
  ERR_INVALID_ARG_TYPE: 'No path given',
  ENOENT: 'Invalid path given'
})

// Generic error interface that derives from the given
// error type
interface CustomError<T extends ErrorTypes> extends Error {
  name: T
  options: string[]
}

// The two sides of the "Either" type. Using tags for pattern
// matching later on
type Failure<E> = { readonly _tag: 'error', readonly error: E } // left side of either
type Success<V> = { readonly _tag: 'value', readonly value: V } // right side of either

// The "Either" type (I like "Result", "Failure", "Success" better
// than "Either", "Left", "Right")
type Result<E, V> = Failure<E> | Success<V>

// Functions for each side of the Either that take in a value and
// return the respective type
const _failure = <E, V = never>(e: E): Result<E, V> => ({ _tag: 'error', error: e })
const _success = <V, E = never>(v: V): Result<E, V> => ({ _tag: 'value', value: v })

const Failure: <E = never, V = never>(e: E) => Result<E, V> = _failure
const Success: <E = never, V = never>(v: V) => Result<E, V> = _success

// const Success = <T>(value: T): Success<T> => ({ tag: 'value', value})
// const Failure = <T>(error: T): Failure<T> => ({tag: 'error', value: error})

// Helper function to quickly create custom errors
const createError = <T extends ErrorTypes>(type: T, options: string[]): CustomError<T> => {
  const error = new Error(ErrorMessages[type]) as CustomError<T>
  error.name = type
  error.options = options
  return error
}

// Creating some dummy errors for testing
// The type of this error would be <CustomError<'NO_USER_NAME'>>
// Same for the two below
const noNameError = createError('NO_USER_NAME', [])
const noEmailError = createError('NO_USER_EMAIL', [])
const tooYoungError = createError('USER_TOO_YOUNG', [])
const noValidNameError = createError('USER_NO_VALID_NAME', [])
const noPathGivenError = createError('ERR_INVALID_ARG_TYPE', [])
const invalidPathGivenError = createError('ENOENT', [])

// Dummy User type for testing
type User = {
  name: string;
  email: string;
  age: number;
}

// SWITCH FUNCTIONS
// These are the logic functions of the pipeline
// They receive a User and do something with it
// (validate it, mutate it, whatever)

class TestError extends Error {}
class FooError extends Error {}
class BarError extends Error {}

/**
 * "Validates" the user name
 * @param user 
 * @returns 
 */
const validateUserName = (user: User): Result<TestError, User> => {
  console.log('name')
  if (user?.name?.length) {
    return Success(user)
  }

  return Failure(new TestError('bla'))
}


/**
 * "Validates" user age
 * 
 * @param user 
 * @returns 
 */
const validateUserAge = (user: User): Result<CustomError<'USER_TOO_YOUNG'>, User> => {
  console.log('age')
  if (user.age >= 18) {
    return Success(user)
  }

  return Failure(tooYoungError)
}

/**
 * "Validates" user email 
 * @param user 
 * @returns 
 */
const validateUserEmail = (user: User): Result<CustomError<'NO_USER_EMAIL'>, User> => {
  console.log('email')
  if (user.email.length) {
    return Success(user)
  }

  return Failure(noEmailError)
}


const throwableOperation = async (user: User): Promise<Result<FooError | BarError, User>> => {
  if (user.email.length) {
    await realpath('')
    return Success(user)
  }

  return Failure(new FooError('bls'))
}

/**
 * Capitalizes the user name
 * 
 * This is a "single-track" function. Meaning it doesn't return
 * a {@link Result}, {@link Success} or {@link Failure}. It just
 * mutates the incoming data and returns it. See below how we
 * integrate it into the pipeline.
 * 
 * @param user 
 * @returns 
 */
const capitalizeName = (user: User): User => {
  return {
    ...user,
    name: user.name.toUpperCase()
  }
}

export const dual: {
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    arity: Parameters<DataFirst>['length'],
    body: DataFirst
  ): DataLast & DataFirst
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    isDataFirst: (args: IArguments) => boolean,
    body: DataFirst
  ): DataLast & DataFirst
} = (arity: any, body: any) => {
  const isDataFirst: (args: IArguments) => boolean = typeof arity === 'number' ? (args) => args.length >= arity : arity
  return function (this: any) {
    const args = Array.from(arguments)
    if (isDataFirst(arguments)) {
      return body.apply(this, args)
    }
    return (self: any) => body(self, ...args)
  }
}

const flatMap: {
  <A, E2, B>(nextFunction: (a: A) => Result<E2, B> | Promise<Result<E2, B>>): <E1>(input: Result<E1, A>) => Result<E1 | E2, B>
  <E1, A, E2, B>(input: Result<E1, A>, nextFunction: (a: A) => Result<E2, B>): Result<E1 | E2, B>
} = dual(2,
  <E1, A, E2, B>(input: Result<E1, A>, nextFunction: (a: A) => Result<E2, B>): Result<E1 | E2, B> => match(
    nextFunction,
    input
  )
)

// const flattenW: <E1, E2, A>(mma: Result<E1, Result<E2, A>>) => Result<E1 | E2, A> = flatMap((x) => x)
// const flatten: <E, A>(mma: Result<E, Result<E, A>>) => Result<E, A> = flattenW


/**
 * PATTERN MATCHING
 * 
 * @param {Result} input Result from previous function to look at
 * @param {Function} error Callback for when bad path is matched
 * @param {Function} value Callback for when happy path is matched
 * @returns 
 */
const match = <E1, A, E2, B>(nextFunction: (a: A) => Result<E2, B>, input: Result<E1, A>) => {
  switch (input._tag) {
    case 'error':
      return input
    case 'value':
      return nextFunction(input.value)
    default:
      const _exhaustive: never = input
      return _exhaustive
  }
}


/**
 * BIND ADAPTER FUNCTION
 * 
 * This function binds a switch function, like {@link validateUserName}. A switch
 * function is a function that has one input (data) but may return two different
 * things, either data (happy path) or an error (bad path).
 * 
 * Bind will return a function that accepts the output of the previous function
 * in the pipeline and will match it (using {@link match}), if it matches the
 * happy case, it will execute {@param switchFunction} it will call it with the
 * output. If it matches the bad case, it will return the error immediately
 * and not pass it on to the function it binds. 
 * 
 * @param {Function} switchFunction 
 * @returns 
 */
const bind = <E1, A, B>(singleFunction: (a: A) => B) => (previousValue: Result<E1, A>): Result<E1, B> => match(
  (value) => Success(singleFunction(value)),
  previousValue,
)

// const bind = <L, R>(switchFunction: (a: R) => Result<L, R>) => <pL>(previousValue: Result<pL, R>) => match(
//   previousValue,
//   error => error,
//   value => switchFunction(value)
// )
// const map = <pE, pV, E, V>(switchFunction: (v: pV) => Result<E, V>) => (previousValue: Result<pE, pV>) => match(
//   previousValue,
//   // error => error,
//   value => switchFunction(value)
// )

// /**
//  * MAP ADAPTER FUNCTION
//  * 
//  * Converts a "one-track" function, meaning a function that does not return
//  * an Either ({@link Result}), to a switch function by wrapping its return
//  * value in a {@link Success}. 
//  *  
//  * @param singleFunction 
//  * @returns 
//  */
// const map = <R, T>(singleFunction: (a: R) => T) => <L>(previousValue: Result<L, R>) => match(
//   previousValue,
//   error => error,
//   value => Success(singleFunction(value))
// )

/**
 * TEE ADAPTER FUNCTION
 * 
 * Converts a dead-end function, meaning a function that returns {@code void}
 * into usable "track-segment" by executing the void function with the output
 * of the previous function and then returns that output to the next function
 * 
 * @param deadEndFunction 
 * @returns 
 */
const tap = <T>(deadEndFunction: (a: T) => void) => (previousValue: T) => {
  deadEndFunction(previousValue)

  return previousValue
}

/**
 * GUARD ADAPTER FUNCTION
 * 
 * Wraps the {@param switchFunction} in a try/catch block and if an error is
 * thrown, it will wrap it in a {@link Failure} and return it. Otherwise it
 * will return the result of the function.
 * 
 * @param switchFunction
 * @returns 
 */
// const guard = <E1, A, E2, B>(switchFunction: (a: A) => Result<E2, B>) => (previousValue: Result<E1, A>): Result<E1 | E2, B> => match(
//   (value) => {
//     try {
//       return switchFunction(value)
//     } catch(e) {
//       return Failure(e)
//     }
//   },
//   previousValue,
// )
const guard = <L, R, T extends Error>(
  switchFunction: (a: R) => Result<L, R> | Promise<Result<L, R>>,
  errors?: {[key: string]: T}
) => async (previousValue: R) => {
  try {
    return await switchFunction(previousValue)
  } catch (e: any) {
    return Failure(errors?.[e.code] || e as L)
  }
}


// Play with these values and check the content of test1
// Only the first error that occurs will be logged in the
// end because no other link in the chain will be executed
// after an error occured
const john: User = {
  name: 'john',
  email: 'john@doe.com',
  age: 18
}

class EnoentError extends Error {
  _tag: ''
}

const test1 = asyncPipe(
  Success(john),
  // x => x,
  flatMap(validateUserName),
  x => x,
  flatMap(validateUserAge),
  x => x,
  flatMap(validateUserEmail),
  x => x,
  bind(capitalizeName),
  x => x,
  tap((a) => console.log(a)),
  x => x,
  flatMap(guard(throwableOperation, {
    'ENOENT': new BarError(),
  })),
  x => x,
  // bind(guard((a) => { throw new Error('test') })),
  // bind(tee((x) => {console.log('tee', x)})),
)


console.log('t1', await test1)
const i = 1