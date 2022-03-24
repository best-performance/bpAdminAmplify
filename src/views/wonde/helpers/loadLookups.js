const AWS = require('aws-sdk')
const { batchWrite } = require('helpers') // bc helper fn
const { parse } = require('csv-parse/sync') // to parse csv files
const fsp = require('fs').promises // basic file reading - no install needed

// These tables were creaetd by the CDK
// Not needed for the prod uploader - only while in sandbox
const COUNTRY_TABLE = 'Country'
const STATE_TABLE = 'State'
const LEARNINGAREA_TABLE = 'LearningArea'
const YEARLEVEL_TABLE = 'YearLevel'

const lookupTables = [
  './lookupData/Country.csv',
  './lookupData/State.csv',
  './lookupData/LearningArea.csv',
  './lookupData/YearLevel.csv',
]

export async function populateLookups() {
  // read in an populate the lookup tables ( data in csv files is from edCompanion prod)
  console.log('starting saving lookups')

  const docClient = new AWS.DynamoDB.DocumentClient() // used by all functions

  // We define the sub functions as async in order to push them to a stack to be executed
  // sequentially. Refer to this link:
  //https://www.coreycleary.me/executing-arrays-of-async-await-javascript-functions-in-series-vs-concurrently/

  async function runAll() {
    let fnArray = []
    let responseArray = []
    fnArray.push(populateCountry)
    fnArray.push(populateState)
    fnArray.push(populateLearningArea)
    //fnArray.push(populateYearLevel); // not used. Instead we use the batch version below
    fnArray.push(populateYearLevelBatch) // 14 records in 700mS with docClient.batchWrite() vs 1.8secs above

    for (const fn of fnArray) {
      let response = await fn() // call function to get returned Promise
      responseArray.push(response)
    }
    console.log(responseArray)
  }

  await runAll()
  return 'populateLookups done'
  /** ---------------------------------------------------------------------- */
  async function populateCountry() {
    // only Australia so far

    // first lets check if the table is already polulated
    try {
      const params = {
        TableName: COUNTRY_TABLE,
      }
      let response = await docClient.scan(params).promise()
      if (response.Count > 0) {
        return true
      }
    } catch (err) {
      console.log(err)
      return { err }
    }
    // we reached here because the table has no entries
    try {
      let csvData = await fsp.readFile(lookupTables[0]) // read the Country csv
      let parsedData = parse(csvData, { columns: true }) // parse to array of objects
      console.log(`${lookupTables[0]}`, parsedData)

      console.time('Country saved in')
      const params = {
        TableName: COUNTRY_TABLE,
        Item: {
          id: parsedData[0].id,
          __typename: parsedData[0].__typename,
          createdAt: parsedData[0].createdAt,
          updateAt: parsedData[0].updatedAt,
          countryCode: parsedData[0].countryCode,
          name: parsedData[0].name,
        },
      }
      await docClient.put(params).promise()
      console.timeEnd('Country saved in')

      console.log(`Lookup table ${lookupTables[0]} saved`)
      return true // all good
    } catch (error) {
      console.log(error)
      return { error }
    }
  }

  /** ---------------------------------------------------------------------- */
  async function populateState() {
    // first lets check if the table is already polulated
    try {
      const params = {
        TableName: STATE_TABLE,
      }
      let response = await docClient.scan(params).promise()
      if (response.Count > 0) {
        return true
      }
    } catch (err) {
      console.log(err)
      return { err }
    }
    // we reached here because the table has no entries
    try {
      let csvData = await fsp.readFile(lookupTables[1]) // read the State csv
      let parsedData = parse(csvData, { columns: true }) // parse to array of objects
      console.log(`${lookupTables[1]}`, parsedData)

      console.time('States saved in')
      await Promise.all(
        parsedData.map((item) => {
          // save to table
          const params = {
            TableName: STATE_TABLE,
            Item: {
              id: item.id,
              __typename: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              countryID: item.countryID,
              stateCode: item.stateCode,
              name: item.name,
            },
          }
          return docClient.put(params).promise()
        }),
      )
      console.timeEnd('States saved in')
      return true // all good
    } catch (error) {
      console.log(error)
      return false
    }
  }
  /** ---------------------------------------------------------------------- */
  async function populateLearningArea() {
    // first lets check if the table is already populated
    try {
      const params = {
        TableName: LEARNINGAREA_TABLE,
      }
      let response = await docClient.scan(params).promise()
      if (response.Count > 0) {
        return true
      }
    } catch (err) {
      console.log(err)
      return { err }
    }
    // we reached here because the table has no entries
    try {
      let csvData = await fsp.readFile(lookupTables[2]) // read the LearningArea csv
      let parsedData = parse(csvData, { columns: true }) // parse to array of objects
      console.log(`${lookupTables[2]}`, parsedData)

      console.time('LearningArea saved in')
      await Promise.all(
        parsedData.map((item) => {
          // save to table
          const params = {
            TableName: LEARNINGAREA_TABLE,
            Item: {
              id: item.id,
              __typeName: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              areaName: item.areaName,
              colour: item.colour,
            },
          }
          return docClient.put(params).promise()
        }),
      )
      console.timeEnd('LearningArea saved in')
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }
  /** ---------------------------------------------------------------------- */
  async function populateYearLevel() {
    // not used. Instead we use the batch version below
    // polulate the YearLevel lookup table

    // first lets check if the table is already polulated
    try {
      const params = {
        TableName: YEARLEVEL_TABLE,
      }
      let response = await docClient.scan(params).promise()
      if (response.Count > 0) {
        return true
      }
    } catch (err) {
      console.log(err)
      return { err }
    }
    // we reached here because the table has no entries
    try {
      let csvData = await fsp.readFile(lookupTables[3]) // YearLevel.csv
      let parsedData = parse(csvData, { columns: true }) // parse to array of objects

      console.log(`${lookupTables[3]}`, parsedData.length, parsedData[0])

      console.time('YearLevels saved in')
      await Promise.all(
        parsedData.map((item, index) => {
          // save to table
          const params = {
            TableName: YEARLEVEL_TABLE,
            Item: {
              id: item.id,
              __typeName: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              description: item.description,
              type: item.type,
              yearCode: item.yearCode,
            },
          }
          return docClient.put(params).promise()
        }),
      )
      console.timeEnd('YearLevels saved in')
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }

  /**-------------------------------------------------------------------- */
  async function populateYearLevelBatch() {
    // first lets check if the table is already polulated
    try {
      const params = {
        TableName: YEARLEVEL_TABLE,
      }
      let response = await docClient.scan(params).promise()
      if (response.Count > 0) {
        return true
      }
    } catch (err) {
      console.log(err)
      return { err }
    }
    // we reached here because the table has no entries

    let BATCH_SIZE = 25
    // polulate the YearLevel lookup table, but using a batch upload
    try {
      let csvData = await fsp.readFile(lookupTables[3]) // YearLevel.csv
      let parsedData = parse(csvData, { columns: true }) // parse to array of objects

      console.log(`${lookupTables[3]}`, parsedData.length, parsedData[0])
      // Find no of batches needed
      let batchesCount = parseInt(parsedData.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = parsedData.length % BATCH_SIZE // which could be 0

      // process each batch
      let index = 0 //index in the data array - incremented after each push
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: parsedData[index].id,
                __typeName: parsedData[index].__typename,
                createdAt: parsedData[index].createdAt,
                updateAt: parsedData[index].updatedAt,
                description: parsedData[index].description,
                type: parsedData[index].type,
                yearCode: parsedData[index].yearCode,
              },
            },
          })
          index++
        } // end batch loop
        let response = await batchWrite(batchToWrite, YEARLEVEL_TABLE)
        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end full array loop
      return true
    } catch (error) {
      console.log(error)
      return false
    }
  }
}
