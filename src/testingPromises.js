// This is not to be included in anything - just for testing patterms around promises and Promise.all()

// This is a function that takes a while a returns a promise
function delay(t, v) {
  return new Promise(function (resolve) {
    setTimeout(resolve.bind(null, v), t)
  })
}

async function test() {
  let delaysArray = [3000, 4000, 5000]
  let promises = []
  // case 1 - awaits 3 secs on a simple promise
  console.time('promise chain 0 took')
  await delay(3000)
  console.log('3 secs are up')
  console.timeEnd('promise chain 0 took')

  //   // case 2 - awaits 5 secs until all promises are done
  console.time('promise chain 1 took')
  promises = delaysArray.map(delay)
  await Promise.all(promises)
  console.timeEnd('promise chain 1 took') // all done in 5 secs as expected

  //   // case 3 - waits 5 secs until all promises are done - different syntax
  console.time('promise chain 2 took')
  promises = delaysArray.map((item) => {
    console.log(item) // prints these all at once
    return delay(item) // correctly does things concurrently and finishes in 5 secs
  })
  await Promise.all(promises)
  console.timeEnd('promise chain 2 took')

  // case 3 - waits 5 secs until all promises are done - different syntax
  console.time('promise chain 3 took')
  promises = delaysArray.map(async (item) => {
    console.log(item) // prints these all at once
    return await delay(item) // correctly does things concurrently and finishes in 5 secs
  })
  await Promise.all(promises)

  // Conclusion - case 2 a 3 are the same?

  console.timeEnd('promise chain 3 took') // all done in 5 secs as expected
  return 'Test'
}

test().then((result) => console.log('done:', result))

// Heres how to do stuff serially
// We define the sub functions as async in order to push them to a stack to be executed
// sequentially. Refer to this link:
//https://www.coreycleary.me/executing-arrays-of-async-await-javascript-functions-in-series-vs-concurrently/

async function test2() {
  let fnArray = []

  fnArray.push(returnPromise2)
  fnArray.push(returnPromise1)

  let responseArray = []

  for (const fn of fnArray) {
    let response = await fn()
    console.log(response)
    responseArray.push(response)
  }

  // code is blocked till all promises are resolved
  console.log(responseArray) // this prints [ 'promise 2', 'promise 1' ]
  return 'Test2'

  async function returnPromise1() {
    await delay(1000)
    return 'promise 1' // this reurns a promise due to async
  }

  async function returnPromise2() {
    await delay(5000)
    return 'promise 2' // this reurns a promise due to async
  }
}

test2().then((result) => console.log('done:', result))
