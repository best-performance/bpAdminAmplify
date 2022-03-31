import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials'
import AWS from 'aws-sdk'
export async function batchWrite(arrayOfItems, tableName) {
  await updateAWSCredentials()
  let docClient = new AWS.DynamoDB.DocumentClient()
  // This is a generic function to batch write up to 25 items to a nominated table
  // It is used by any function that needs to save a lot of records in batches of 25
  // it expects an array of objects with 1 - 25 elements
  // Each element is formatted like this - as per needed by documentClient.batchWrite()
  // {
  //    PutRequest: {
  //      Item: {
  //        id: parsedData[index].id,
  //        __typeName: parsedData[index].__typename,
  //        createdAt: parsedData[index].createdAt,
  //        updateAt: parsedData[index].updatedAt,
  //        description: parsedData[index].description,
  //        type: parsedData[index].type,
  //        yearCode: parsedData[index].yearCode,
  //      },
  //    },
  // }

  if (arrayOfItems.length === 0) return { result: true, msg: 'no records ' }

  // construct the params object
  let params = {
    RequestItems: {
      [tableName]: arrayOfItems, //[] notation constructs key name from variable
    },
  }

  // do the batchWrite()
  try {
    await docClient.batchWrite(params).promise()
    return { result: true, msg: `${arrayOfItems.length} records saved` }
  } catch (err) {
    console.log(`error saving to ${tableName}`, err.message)
    return { result: false, msg: err.message }
  }
} // end of batchWrite()
