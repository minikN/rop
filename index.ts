import { curry } from './util'
import { pipe } from './util/pipe'

// ---------------------------------
// Holy bible: https://github.com/swlaschin/RailwayOrientedProgramming/blob/master/Railway_Oriented_Programming_Slideshare.pdf
// ---------------------------------

// List of possible error types
type ErrorTypes =
  | 'NO_USER_NAME'
  | 'NO_USER_EMAIL'
  | 'USER_TOO_YOUNG'

// Message for each error type
const ErrorMessages = Object.freeze({
  NO_USER_NAME: 'No user name given: %d',
  NO_USER_EMAIL: 'No email given: %d',
  USER_TOO_YOUNG: 'User too young: %d'
})

// Generic error interface that derives from the given
// error type
interface CustomError<T extends ErrorTypes> extends Error {
  name: T
  options: string[]
}

// The two sides of the "Either" type. Using tags for pattern
// matching later on
type Failure<T> = { tag: 'error', value: T } // left side of either
type Success<T> = { tag: 'value', value: T } // right side of either

// The "Either" type (I like "Result", "Failure", "Success" better
// than "Either", "Left", "Right")
type Result<E, V> = Failure<E> | Success<V>

// Functions for each side of the Either that take in a value and
// return the respective type
const Success = <T>(value: T): Success<T> => ({ tag: 'value', value})
const Failure = <T>(error: T): Failure<T> => ({tag: 'error', value: error})

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

/**
 * "Validates" the user name
 * @param user 
 * @returns 
 */
const validateUserName = (user: User): Result<CustomError<'NO_USER_NAME'>, User> => {
  console.log('name')
  if (user?.name?.length) {
    return Success(user)
  }

  return Failure(noNameError)
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
/**
 * PATTERN MATCHING
 * 
 * @param {Result} input Result from previous function to look at
 * @param {Function} error Callback for when bad path is matched
 * @param {Function} value Callback for when happy path is matched
 * @returns 
 */
const match = <T, G, L, R>(input: Result<L, R>, error: (error: L) => T, value: (value: R) => G) => {
  switch (input.tag) {
    case 'error':
      return error(input.value)
    case 'value':
      return value(input.value)
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
// const bind = <L, R>(switchFunction: (a: R) => Result<L, R>) => <pL>(previousValue: Result<pL, R>) => match(
//   previousValue,
//   error => error,
//   value => switchFunction(value)
// )
const bind = curry((switchFunction, previousValue) => match(
  previousValue,
  error => error,
  value => switchFunction(value)
))

/**
 * MAP ADAPTER FUNCTION
 * 
 * Converts a "one-track" function, meaning a function that does not return
 * an Either ({@link Result}), to a switch function by wrapping its return
 * value in a {@link Success}. 
 *  
 * @param singleFunction 
 * @returns 
 */
const map = <R, T>(singleFunction: (a: R) => T) => <L>(previousValue: Result<L, R>) => match(
  previousValue,
  error => error,
  value => Success(singleFunction(value))
)

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
const tee = <T>(deadEndFunction: (a: T) => void) => (previousValue: T) => {
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
const guard = <L, R>(switchFunction: (a: R) => Result<L, R>) => (previousValue: R) => {
  try {
    return switchFunction(previousValue)
  } catch (e) {
    return Failure(e as L)
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

const test1 = pipe(
  validateUserName,
  bind(validateUserEmail),
  bind(validateUserAge),
  map(capitalizeName),
  bind(guard((a) => { throw new Error('test') })),
  bind(tee((x) => {console.log('tee', x)})),
)(john)


console.log('t1', test1)